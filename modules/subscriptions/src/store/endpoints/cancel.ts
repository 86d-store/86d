import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SubscriptionController } from "../../service";

export const cancelSubscription = createStoreEndpoint(
	"/subscriptions/me/cancel",
	{
		method: "POST",
		body: z.object({
			id: z.string().max(200),
			cancelAtPeriodEnd: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers
			.subscriptions as SubscriptionController;

		const existing = await controller.getSubscription(ctx.body.id);
		if (!existing || existing.customerId !== session.user.id) {
			return { error: "Subscription not found", status: 404 };
		}

		const subscription = await controller.cancelSubscription({
			id: ctx.body.id,
			cancelAtPeriodEnd: ctx.body.cancelAtPeriodEnd,
		});
		if (!subscription) {
			return { error: "Subscription not found", status: 404 };
		}

		void ctx.context.events?.emit("subscription.cancelled", {
			subscriptionId: subscription.id,
			planId: subscription.planId,
			customerId: subscription.customerId,
			email: subscription.email,
		});

		return { subscription };
	},
);
