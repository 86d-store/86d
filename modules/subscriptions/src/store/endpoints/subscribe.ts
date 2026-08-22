import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SubscriptionController } from "../../service";

export const subscribe = createStoreEndpoint(
	"/subscriptions/subscribe",
	{
		method: "POST",
		body: z.object({
			planId: z.string().max(200),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers
			.subscriptions as SubscriptionController;
		const plan = await controller.getPlan(ctx.body.planId);
		if (!plan) return { error: "Plan not found", status: 404 };
		if (!plan.isActive) return { error: "Plan is not active", status: 400 };

		// Plans with a price and no trial period require a completed payment.
		const hasTrial = plan.trialDays !== undefined && plan.trialDays > 0;
		const requiresPayment = plan.price > 0 && !hasTrial;

		if (requiresPayment) {
			return {
				code: "SUBSCRIPTION_PAYMENT_ACTIVATION_UNAVAILABLE",
				error:
					"Paid subscription activation is unavailable until payment proofs are purpose-bound and duplicate-safe.",
				status: 503,
			};
		}

		const subscription = await controller.subscribe({
			planId: ctx.body.planId,
			email: session.user.email,
			customerId: session.user.id,
		});
		void ctx.context.events?.emit("subscription.created", {
			subscriptionId: subscription.id,
			planId: subscription.planId,
			customerId: subscription.customerId,
			email: subscription.email,
		});
		return { subscription };
	},
);
