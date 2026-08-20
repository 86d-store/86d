import { createStoreEndpoint } from "@86d-app/core/api";
import { paymentCheckoutCapability } from "@86d-app/core/commerce-capabilities";
import { z } from "@86d-app/core/zod";
import type { CheckoutController } from "../../service";

export const getPayment = createStoreEndpoint(
	"/checkout/sessions/:id/payment/status",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.checkout as CheckoutController;
		const existing = await controller.getById(ctx.params.id);
		if (!existing) {
			return { error: "Checkout session not found", status: 404 };
		}

		// Ownership check
		const userId = ctx.context.session?.user.id;
		if (existing.customerId && (!userId || existing.customerId !== userId)) {
			return { error: "Checkout session not found", status: 404 };
		}

		// No payment intent yet
		if (!existing.paymentIntentId) {
			return {
				payment: null,
				session: existing,
			};
		}

		// A zero-total Checkout has no external Payment to refresh.
		if (existing.paymentIntentId === "no_payment_required") {
			return {
				payment: {
					id: existing.paymentIntentId,
					status: existing.paymentStatus ?? "succeeded",
					amount: existing.total,
					currency: existing.currency,
				},
				session: existing,
			};
		}

		const paymentResult = await ctx.context.capabilities.invoke(
			paymentCheckoutCapability,
			{ operation: "get", intentId: existing.paymentIntentId },
		);
		if (paymentResult.ok) {
			const intent = paymentResult.decision;
			// Sync status back to session if changed
			if (intent.status !== existing.paymentStatus) {
				await controller.setPaymentIntent(
					ctx.params.id,
					intent.id,
					intent.status,
				);
			}
			return { payment: intent, session: existing };
		} else {
			return {
				code: "CHECKOUT_PAYMENT_UNAVAILABLE",
				error: "An authoritative payment status is unavailable.",
				status: paymentResult.failure.code === "PAYMENT_NOT_FOUND" ? 404 : 503,
			};
		}
	},
);
