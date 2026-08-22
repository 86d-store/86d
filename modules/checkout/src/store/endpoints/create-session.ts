import { createStoreEndpoint } from "@86d-app/core/api";
import {
	cartSnapshotCapability,
	priceListResolveCapability,
	productPriceConversionCapability,
	productResolveCapability,
} from "@86d-app/core/commerce-capabilities";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import { isCapabilityUnavailable } from "../../capability-failures";
import type { CheckoutController, CheckoutLineItem } from "../../service";
import { createGuestProofMetadata, setGuestProofCookie } from "./guest-proof";
import { recalculateTax, taxRecalculationError } from "./recalculate-tax";
import { resolveStoreCustomer } from "./store-customer";

const addressSchema = z.object({
	firstName: z.string().min(1).max(200).transform(sanitizeText),
	lastName: z.string().min(1).max(200).transform(sanitizeText),
	company: z.string().max(200).transform(sanitizeText).optional(),
	line1: z.string().min(1).max(500).transform(sanitizeText),
	line2: z.string().max(500).transform(sanitizeText).optional(),
	city: z.string().min(1).max(200).transform(sanitizeText),
	state: z.string().min(1).max(200).transform(sanitizeText),
	postalCode: z.string().min(1).max(20),
	country: z.string().length(2),
	phone: z
		.string()
		.max(50)
		.optional()
		.transform((s) => (s === undefined ? undefined : sanitizeText(s))),
});

function isAuthoritativeAmount(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export const createSession = createStoreEndpoint(
	"/checkout/sessions",
	{
		method: "POST",
		body: z.object({
			cartId: z.string().min(1).max(200),
			guestEmail: z.string().email().max(320).optional(),
			currency: z
				.string()
				.regex(/^[A-Z]{3}$/)
				.optional(),
			shippingAddress: addressSchema.optional(),
			billingAddress: addressSchema.optional(),
		}),
	},
	async (ctx) => {
		const authSubject = ctx.context.session?.user.id;
		const controller = ctx.context.controllers.checkout as CheckoutController;
		const guestId = authSubject ? undefined : ctx.getCookie("cart_guest_id");
		const cartOwner = authSubject
			? { customerId: authSubject }
			: guestId
				? { guestId }
				: undefined;
		if (!cartOwner) {
			return { error: "Cart not found", status: 404 };
		}

		const storeCustomer = await resolveStoreCustomer(ctx.context);
		if (!storeCustomer.ok) {
			return storeCustomer.response;
		}

		const snapshot = await ctx.context.capabilities.invoke(
			cartSnapshotCapability,
			{
				cartId: ctx.body.cartId,
				...cartOwner,
			},
		);
		if (!snapshot.ok) {
			if (
				snapshot.failure.code === "CART_NOT_FOUND" ||
				snapshot.failure.code === "CART_NOT_OWNED"
			) {
				return { error: "Cart not found", status: 404 };
			}
			if (snapshot.failure.code === "CART_NOT_ACTIVE") {
				return { error: "Cart is not active", status: 409 };
			}
			return {
				code: "CHECKOUT_CART_UNAVAILABLE",
				error: "An authoritative Cart snapshot is unavailable.",
				status: 503,
			};
		}
		if (snapshot.decision.items.length === 0) {
			return { error: "Cart is empty", status: 400 };
		}

		const authoritativeLineItems: CheckoutLineItem[] = [];
		for (const item of snapshot.decision.items) {
			const resolved = await ctx.context.capabilities.invoke(
				productResolveCapability,
				{
					productId: item.productId,
					...(item.variantId ? { variantId: item.variantId } : {}),
				},
			);
			if (!resolved.ok) {
				if (
					resolved.failure.code === "not_found" ||
					resolved.failure.code === "not_active"
				) {
					return { error: "Product is not available", status: 400 };
				}
				if (
					resolved.failure.code === "variant_not_found" ||
					resolved.failure.code === "variant_mismatch"
				) {
					return { error: "Product variant is not available", status: 400 };
				}
				return {
					code: "CHECKOUT_PRICING_UNAVAILABLE",
					error: "Authoritative product pricing is unavailable.",
					status: 503,
				};
			}

			const { product, variant } = resolved.decision;
			if (product.id !== item.productId) {
				return { error: "Product is not available", status: 400 };
			}
			if (!isAuthoritativeAmount(product.price)) {
				return {
					code: "CHECKOUT_PRICING_UNAVAILABLE",
					error: "Authoritative product pricing is unavailable.",
					status: 503,
				};
			}

			let name = product.name;
			let price = product.price;
			let sku = product.sku;
			if (item.variantId) {
				if (
					!variant ||
					variant.id !== item.variantId ||
					variant.productId !== product.id
				) {
					return { error: "Product variant is not available", status: 400 };
				}
				if (!isAuthoritativeAmount(variant.price)) {
					return {
						code: "CHECKOUT_PRICING_UNAVAILABLE",
						error: "Authoritative variant pricing is unavailable.",
						status: 503,
					};
				}
				name = `${product.name} - ${variant.name}`;
				price = variant.price;
				sku = variant.sku ?? product.sku;
			}

			authoritativeLineItems.push({
				productId: product.id,
				...(item.variantId ? { variantId: item.variantId } : {}),
				name,
				...(sku ? { sku } : {}),
				price,
				quantity: item.quantity,
			});
		}

		// Apply price list overrides when the price-lists module is active.
		// resolvePrices() returns only products covered by an active price list;
		// items absent from the map keep their base price (or get currency-converted below).
		const priceListCoveredIds = new Set<string>();
		const productIds = [
			...new Set(authoritativeLineItems.map((i) => i.productId)),
		];
		try {
			const priceListResult = await ctx.context.capabilities.invoke(
				priceListResolveCapability,
				{
					productIds,
					...(ctx.body.currency ? { currency: ctx.body.currency } : {}),
				},
			);
			if (priceListResult.ok) {
				const resolved = priceListResult.decision.prices;
				for (const item of authoritativeLineItems) {
					const override = resolved[item.productId];
					if (override) {
						if (!isAuthoritativeAmount(override.price)) {
							return {
								code: "CHECKOUT_PRICING_UNAVAILABLE",
								error: "Authoritative price-list resolution is unavailable.",
								status: 503,
							};
						}
						item.price = override.price;
						priceListCoveredIds.add(item.productId);
					}
				}
			} else if (!isCapabilityUnavailable(priceListResult)) {
				return {
					code: "CHECKOUT_PRICING_UNAVAILABLE",
					error: "Authoritative price-list resolution is unavailable.",
					status: 503,
				};
			}
		} catch {
			return {
				code: "CHECKOUT_PRICING_UNAVAILABLE",
				error: "Authoritative price-list resolution is unavailable.",
				status: 503,
			};
		}

		// Apply currency conversion for items not already priced by a price list.
		// When a non-default currency is requested, convert base prices via exchange
		// rates (or price overrides set in the multi-currency module).
		if (ctx.body.currency) {
			for (const item of authoritativeLineItems) {
				if (priceListCoveredIds.has(item.productId)) continue;
				try {
					const converted = await ctx.context.capabilities.invoke(
						productPriceConversionCapability,
						{
							productId: item.productId,
							basePriceInCents: item.price,
							currencyCode: ctx.body.currency,
						},
					);
					if (
						!converted.ok ||
						!isAuthoritativeAmount(converted.decision.amount)
					) {
						return {
							code: "CHECKOUT_PRICING_UNAVAILABLE",
							error: "Authoritative currency conversion is unavailable.",
							status: 503,
						};
					}
					item.price = converted.decision.amount;
				} catch {
					return {
						code: "CHECKOUT_PRICING_UNAVAILABLE",
						error: "Authoritative currency conversion is unavailable.",
						status: 503,
					};
				}
			}
		}

		// Recalculate subtotal and total server-side from validated prices
		const subtotal = authoritativeLineItems.reduce(
			(sum, item) => sum + item.price * item.quantity,
			0,
		);
		const total = subtotal;

		const guestProof = storeCustomer.customerId
			? undefined
			: await createGuestProofMetadata();
		const session = await controller.create({
			cartId: snapshot.decision.cartId,
			...(storeCustomer.customerId
				? { customerId: storeCustomer.customerId }
				: {}),
			...(ctx.body.guestEmail ? { guestEmail: ctx.body.guestEmail } : {}),
			...(ctx.body.currency ? { currency: ctx.body.currency } : {}),
			subtotal,
			total,
			lineItems: authoritativeLineItems,
			...(ctx.body.shippingAddress
				? { shippingAddress: ctx.body.shippingAddress }
				: {}),
			...(ctx.body.billingAddress
				? { billingAddress: ctx.body.billingAddress }
				: {}),
			metadata: {
				cartRevision: snapshot.decision.revision,
				...(guestProof?.metadata ?? {}),
			},
		});
		if (guestProof) setGuestProofCookie(ctx, session, guestProof.proof);

		if (!session.shippingAddress) {
			return { session };
		}

		const tax = await recalculateTax(
			session,
			controller,
			ctx.context.capabilities,
		);
		if (!tax.ok) {
			return taxRecalculationError(tax);
		}

		return { session: tax.session };
	},
);
