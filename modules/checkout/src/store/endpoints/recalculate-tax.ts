import type { CapabilityInvoker } from "@86d-app/core/capabilities";
import { taxQuoteV2Capability } from "@86d-app/core/commerce-capabilities";
import type { CheckoutController, CheckoutSession } from "../../service";

/**
 * Server-owned address normalization identity until Shipping owns a durable
 * normalization version. Checkout must still name the identity it used so Tax
 * can detect stale quotes when normalization changes.
 */
export const CHECKOUT_ADDRESS_NORMALIZATION_VERSION =
	"checkout.shipping-address.v1" as const;

/** Default tax category until Catalog lines carry an authoritative category. */
const DEFAULT_TAX_CATEGORY_ID = "general";

export type RecalculateTaxResult =
	| { ok: true; session: CheckoutSession }
	| {
			ok: false;
			code: "TAX_REVIEW_REQUIRED" | "CHECKOUT_TAX_UNAVAILABLE";
			reason?: string;
	  };

/**
 * Recalculates tax for a checkout session via tax.quote v2.
 *
 * Distributes any order-level discount across line items so Tax sees
 * post-discount amounts. Never writes an inferred zero: CALCULATED /
 * NO_NEXUS / EXEMPT / MARKETPLACE_COLLECTED persist a reasoned amount;
 * REVIEW_REQUIRED fails closed without mutating sellable tax.
 */
export async function recalculateTax(
	session: CheckoutSession,
	checkoutController: CheckoutController,
	capabilities: CapabilityInvoker,
): Promise<RecalculateTaxResult> {
	if (!session.shippingAddress) {
		return { ok: true, session };
	}

	const lineItems = await checkoutController.getLineItems(session.id);
	if (lineItems.length === 0) {
		return { ok: true, session };
	}

	const discountRatio =
		session.subtotal > 0 && session.discountAmount > 0
			? session.discountAmount / session.subtotal
			: 0;

	const taxResult = await capabilities.invoke(taxQuoteV2Capability, {
		currency: session.currency,
		address: {
			country: session.shippingAddress.country.toUpperCase(),
			state: session.shippingAddress.state,
			...(session.shippingAddress.city
				? { city: session.shippingAddress.city }
				: {}),
			...(session.shippingAddress.postalCode
				? { postalCode: session.shippingAddress.postalCode }
				: {}),
			normalizationVersion: CHECKOUT_ADDRESS_NORMALIZATION_VERSION,
		},
		lineItems: lineItems.map((item, index) => {
			const grossAmount = item.price * item.quantity;
			const discountAmount = Math.round(grossAmount * discountRatio);
			return {
				lineId: `${item.productId}:${item.variantId ?? ""}:${index}`,
				productId: item.productId,
				...(item.variantId ? { variantId: item.variantId } : {}),
				taxCategoryId: DEFAULT_TAX_CATEGORY_ID,
				quantity: item.quantity,
				unitAmount: item.price,
				...(discountAmount > 0 ? { discountAmount } : {}),
			};
		}),
		shippingAmount: session.shippingAmount,
		...(session.customerId ? { customerId: session.customerId } : {}),
		marketplaceStatus: "NOT_MARKETPLACE",
	});

	if (!taxResult.ok) {
		return { ok: false, code: "CHECKOUT_TAX_UNAVAILABLE" };
	}

	const decision = taxResult.decision;

	if (decision.status === "REVIEW_REQUIRED") {
		return {
			ok: false,
			code: "TAX_REVIEW_REQUIRED",
			reason: decision.reason,
		};
	}

	const taxAmount =
		decision.status === "CALCULATED"
			? (decision.totals.tax ?? null)
			: decision.status === "NO_NEXUS" ||
					decision.status === "EXEMPT" ||
					decision.status === "MARKETPLACE_COLLECTED"
				? (decision.totals.tax ?? 0)
				: null;

	if (taxAmount === null || !Number.isSafeInteger(taxAmount) || taxAmount < 0) {
		return {
			ok: false,
			code: "TAX_REVIEW_REQUIRED",
			reason: decision.reason,
		};
	}

	const updated = await checkoutController.update(session.id, {
		taxAmount,
		metadata: {
			...(session.metadata ?? {}),
			taxQuoteId: decision.quoteId,
			taxQuoteStatus: decision.status,
			taxQuoteReason: decision.reason,
			taxQuoteExpiresAt: decision.expiresAt,
		},
	});

	if (!updated) {
		return { ok: false, code: "CHECKOUT_TAX_UNAVAILABLE" };
	}

	return { ok: true, session: updated };
}

export function taxRecalculationError(
	tax: Extract<RecalculateTaxResult, { ok: false }>,
	session?: CheckoutSession,
) {
	const response: {
		code: string;
		error: string;
		status: 422 | 503;
		currentRevision?: number;
		session?: CheckoutSession;
	} = {
		code: tax.code,
		error:
			tax.code === "TAX_REVIEW_REQUIRED"
				? "Tax requires merchant review before payment."
				: "An authoritative tax decision is unavailable.",
		status: tax.code === "TAX_REVIEW_REQUIRED" ? 422 : 503,
	};
	if (session) {
		response.session = session;
		response.currentRevision = session.revision ?? 1;
	}
	return response;
}
