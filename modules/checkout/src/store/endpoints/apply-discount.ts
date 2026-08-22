import { createStoreEndpoint } from "@86d-app/core/api";
import { discountCodeCapability } from "@86d-app/core/commerce-capabilities";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import { checkoutRevisionSchema, runCheckoutMutation } from "../../concurrency";
import type { CheckoutController } from "../../service";
import { canAccessCheckout } from "./guest-proof";
import { recalculateTax, taxRecalculationError } from "./recalculate-tax";

export const applyDiscount = createStoreEndpoint(
	"/checkout/sessions/:id/discount",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
		body: z.object({
			expectedRevision: checkoutRevisionSchema,
			code: z.string().min(1).max(50).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const checkoutController = ctx.context.controllers
			.checkout as CheckoutController;
		const session = await checkoutController.getById(ctx.params.id);
		if (!session) {
			return { error: "Checkout session not found", status: 404 };
		}

		if (!(await canAccessCheckout(ctx, session))) {
			return { error: "Checkout session not found", status: 404 };
		}

		const result = await ctx.context.capabilities.invoke(
			discountCodeCapability,
			{
				operation: "validate",
				code: ctx.body.code,
				subtotal: session.subtotal,
			},
		);
		if (!result.ok) {
			return {
				code: "CHECKOUT_DISCOUNT_UNAVAILABLE",
				error: "An authoritative discount decision is unavailable.",
				status: 503,
			};
		}
		if (!result.decision.valid) {
			return {
				error: result.decision.error ?? "Invalid promo code",
				status: 400,
			};
		}

		const mutation = await runCheckoutMutation(() =>
			checkoutController.applyDiscount(
				ctx.params.id,
				{
					code: ctx.body.code,
					discountAmount: result.decision.discountAmount,
					freeShipping: result.decision.freeShipping,
				},
				ctx.body.expectedRevision,
			),
		);
		if (!mutation.ok) return mutation.response;
		let updated = mutation.value;

		// Recalculate tax on post-discount amounts
		if (updated) {
			const tax = await recalculateTax(
				updated,
				checkoutController,
				ctx.context.capabilities,
			);
			if (!tax.ok) {
				return taxRecalculationError(tax);
			}
			updated = tax.session;
		}

		return { session: updated };
	},
);
