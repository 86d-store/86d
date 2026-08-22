import { createStoreEndpoint } from "@86d-app/core/api";
import { giftCardCheckoutCapability } from "@86d-app/core/commerce-capabilities";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import { checkoutRevisionSchema, runCheckoutMutation } from "../../concurrency";
import type { CheckoutController } from "../../service";
import { canAccessCheckout } from "./guest-proof";

export const applyGiftCard = createStoreEndpoint(
	"/checkout/sessions/:id/gift-card",
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
			giftCardCheckoutCapability,
			{ operation: "balance", code: ctx.body.code },
		);
		if (!result.ok) {
			if (result.failure.code === "GIFT_CARD_NOT_FOUND") {
				return { error: "Gift card not found", status: 404 };
			}
			return {
				code: "CHECKOUT_GIFT_CARD_UNAVAILABLE",
				error: "An authoritative gift card decision is unavailable.",
				status: 503,
			};
		}
		if (result.decision.operation !== "balance") {
			return {
				code: "CHECKOUT_GIFT_CARD_UNAVAILABLE",
				error: "An authoritative gift card decision is unavailable.",
				status: 503,
			};
		}

		if (result.decision.status !== "active") {
			return {
				error: `Gift card is ${result.decision.status}`,
				status: 400,
			};
		}

		if (result.decision.balance <= 0) {
			return { error: "Gift card has no balance", status: 400 };
		}

		// Cap the gift card amount to the remaining total after discounts
		const remainingTotal =
			session.subtotal +
			session.taxAmount +
			session.shippingAmount -
			session.discountAmount;
		const giftCardAmount = Math.min(
			result.decision.balance,
			Math.max(0, remainingTotal),
		);

		const mutation = await runCheckoutMutation(() =>
			checkoutController.applyGiftCard(
				ctx.params.id,
				{
					code: ctx.body.code.toUpperCase(),
					giftCardAmount,
				},
				ctx.body.expectedRevision,
			),
		);
		if (!mutation.ok) return mutation.response;
		const updated = mutation.value;

		return { session: updated };
	},
);
