import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type {
	CheckoutAddress,
	CheckoutController,
	ShippingQuoteV2Controller,
} from "../../service";
import { canAccessCheckout } from "./guest-proof";
import { recalculateTax, taxRecalculationError } from "./recalculate-tax";

/** Server-owned single-parcel packing until Catalog carries parcel facts. */
export const CHECKOUT_SERVER_PARCEL = {
	parcelReference: "checkout-default-parcel",
	lengthInches: 10,
	widthInches: 8,
	heightInches: 4,
	weightOunces: 16,
} as const;

const USPS_PRIORITY_MAIL_SERVICE = "usps.priority_mail";
const USPS_PRIORITY_MAIL_NAME = "USPS Priority Mail";

function toDestinationAddress(address: CheckoutAddress) {
	return {
		name: `${address.firstName} ${address.lastName}`.trim(),
		...(address.company ? { company: address.company } : {}),
		street1: address.line1,
		...(address.line2 ? { street2: address.line2 } : {}),
		city: address.city,
		state: address.state,
		postalCode: address.postalCode,
		country: address.country,
		...(address.phone ? { phone: address.phone } : {}),
	};
}

function shippingQuoteUnavailable() {
	return {
		code: "CHECKOUT_SHIPPING_QUOTE_V2_REQUIRED",
		error: "Shipping quotes require an expiring, revision-bound Store option.",
		status: 503,
	};
}

export const getShippingRates = createStoreEndpoint(
	"/checkout/sessions/:id/shipping-rates",
	{
		method: "GET",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.checkout as CheckoutController;
		const session = await controller.getById(ctx.params.id);
		if (!session) {
			return { error: "Checkout session not found", status: 404 };
		}

		if (!(await canAccessCheckout(ctx, session))) {
			return { error: "Checkout session not found", status: 404 };
		}

		if (!session.shippingAddress) {
			return {
				code: "CHECKOUT_SHIPPING_ADDRESS_REQUIRED",
				error: "A shipping address is required before quoting.",
				status: 422,
			};
		}

		const shippingV2 = ctx.context.controllers.shippingV2 as
			| ShippingQuoteV2Controller
			| undefined;
		if (!shippingV2) {
			return shippingQuoteUnavailable();
		}

		const connections = await shippingV2.listConnections();
		const connection = connections.find(
			(candidate) =>
				candidate.lifecycle === "enabled" &&
				candidate.health === "healthy" &&
				candidate.capabilities.includes("quote"),
		);
		if (!connection) {
			return shippingQuoteUnavailable();
		}

		const revision = session.revision ?? 1;
		const metadata = session.metadata ?? {};
		const existingQuoteId =
			typeof metadata.shippingQuoteId === "string"
				? metadata.shippingQuoteId
				: undefined;
		const existingOptionId =
			typeof metadata.shippingOptionId === "string"
				? metadata.shippingOptionId
				: undefined;
		if (
			existingQuoteId &&
			existingOptionId &&
			session.shippingAmount !== undefined &&
			session.shippingMethodName === USPS_PRIORITY_MAIL_NAME &&
			metadata.shippingQuoteStatus === "CALCULATED"
		) {
			return {
				session,
				rates: [
					{
						id: existingOptionId,
						name: USPS_PRIORITY_MAIL_NAME,
						zoneName: "USPS",
						price: session.shippingAmount,
						carrier: "USPS",
						service: USPS_PRIORITY_MAIL_SERVICE,
						quoteId: existingQuoteId,
						expiresAt:
							typeof metadata.shippingQuoteExpiresAt === "string"
								? new Date(metadata.shippingQuoteExpiresAt)
								: new Date(),
					},
				],
			};
		}

		let quoted: Awaited<ReturnType<ShippingQuoteV2Controller["createQuote"]>>;
		try {
			quoted = await shippingV2.createQuote({
				checkoutId: session.id,
				checkoutRevision: revision,
				connectionId: connection.id,
				idempotencyKey: `checkout-quote:${session.id}:${revision}`,
				destinationAddress: toDestinationAddress(session.shippingAddress),
				parcelPlan: [CHECKOUT_SERVER_PARCEL],
				currency: session.currency,
			});
		} catch {
			return {
				code: "CHECKOUT_SHIPPING_QUOTE_UNAVAILABLE",
				error: "An authoritative shipping quote is unavailable.",
				status: 503,
			};
		}

		const option =
			quoted.options.find(
				(candidate) => candidate.service === USPS_PRIORITY_MAIL_SERVICE,
			) ?? quoted.options[0];
		if (!option || option.service !== USPS_PRIORITY_MAIL_SERVICE) {
			return {
				code: "CHECKOUT_SHIPPING_QUOTE_UNAVAILABLE",
				error: "An authoritative shipping quote is unavailable.",
				status: 503,
			};
		}

		const bound = await controller.update(session.id, {
			shippingAmount: option.amountMinor,
			shippingMethodName: USPS_PRIORITY_MAIL_NAME,
			metadata: {
				...(session.metadata ?? {}),
				shippingQuoteId: quoted.quote.id,
				shippingOptionId: option.id,
				shippingQuoteStatus: "CALCULATED",
				shippingQuoteExpiresAt: quoted.quote.expiresAt.toISOString(),
			},
		});
		if (!bound) {
			return shippingQuoteUnavailable();
		}

		const tax = await recalculateTax(
			bound,
			controller,
			ctx.context.capabilities,
		);
		if (!tax.ok) {
			return taxRecalculationError(tax, bound);
		}

		return {
			session: tax.session,
			rates: [
				{
					id: option.id,
					name: USPS_PRIORITY_MAIL_NAME,
					zoneName: "USPS",
					price: option.amountMinor,
					carrier: option.carrier,
					service: option.service,
					quoteId: quoted.quote.id,
					expiresAt: quoted.quote.expiresAt,
					deliveryDays: option.deliveryDays,
				},
			],
		};
	},
);
