import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SubscriptionController } from "../../service";

export const adminRenewSubscription = createAdminEndpoint(
	"/admin/subscriptions/:id/renew",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.subscriptions as SubscriptionController;
		const subscription = await controller.renewSubscription(ctx.params.id);
		if (!subscription) {
			return { error: "Subscription not found", status: 404 };
		}
		void ctx.context.events?.emit("subscription.renewed", {
			subscriptionId: subscription.id,
			planId: subscription.planId,
			customerId: subscription.customerId,
			email: subscription.email,
		});
		return { subscription };
	},
);
