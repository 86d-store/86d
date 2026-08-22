import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SubscriptionController } from "../../service";

export const adminCancelSubscription = createAdminEndpoint(
	"/admin/subscriptions/:id/cancel",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			cancelAtPeriodEnd: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.subscriptions as SubscriptionController;
		const subscription = await controller.cancelSubscription({
			id: ctx.params.id,
			cancelAtPeriodEnd: ctx.body.cancelAtPeriodEnd,
		});
		if (!subscription) {
			return { error: "Subscription not found", status: 404 };
		}
		return { subscription };
	},
);
