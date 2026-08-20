import { createStoreEndpoint } from "@86d-app/core/api";
import { storeCreditCheckoutCapability } from "@86d-app/core/commerce-capabilities";
import { z } from "@86d-app/core/zod";
import { checkoutRevisionSchema, runCheckoutMutation } from "../../concurrency";
import type { CheckoutController } from "../../service";
import { canAccessCheckout } from "./guest-proof";

export const applyStoreCredit = createStoreEndpoint(
	"/checkout/sessions/:id/store-credit",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
		body: z.object({ expectedRevision: checkoutRevisionSchema }),
	},
	async (ctx) => {
		const checkoutController = ctx.context.controllers
			.checkout as CheckoutController;
		const session = await checkoutController.getById(ctx.params.id);
		if (!session) {
			return { error: "Checkout session not found", status: 404 };
		}

		// Store credits require an authenticated Store Customer
		if (!ctx.context.session) {
			return { error: "Must be signed in to use store credits", status: 401 };
		}

		if (!(await canAccessCheckout(ctx, session))) {
			return { error: "Checkout session not found", status: 404 };
		}
		if (!session.customerId) {
			return { error: "Must be signed in to use store credits", status: 401 };
		}

		const result = await ctx.context.capabilities.invoke(
			storeCreditCheckoutCapability,
			{ operation: "balance", customerId: session.customerId },
		);
		if (!result.ok) {
			return {
				code: "CHECKOUT_STORE_CREDIT_UNAVAILABLE",
				error: "An authoritative Store credit decision is unavailable.",
				status: 503,
			};
		}
		if (result.decision.operation !== "balance") {
			return {
				code: "CHECKOUT_STORE_CREDIT_UNAVAILABLE",
				error: "An authoritative Store credit decision is unavailable.",
				status: 503,
			};
		}
		if (result.decision.balance <= 0) {
			return { error: "No store credit balance available", status: 400 };
		}

		// Cap the store credit amount to the remaining total after discounts and gift cards
		const remainingTotal =
			session.subtotal +
			session.taxAmount +
			session.shippingAmount -
			session.discountAmount -
			session.giftCardAmount;
		const storeCreditAmount = Math.min(
			result.decision.balance,
			Math.max(0, remainingTotal),
		);

		const mutation = await runCheckoutMutation(() =>
			checkoutController.applyStoreCredit(
				ctx.params.id,
				{ storeCreditAmount },
				ctx.body.expectedRevision,
			),
		);
		if (!mutation.ok) return mutation.response;
		const updated = mutation.value;

		return { session: updated };
	},
);
