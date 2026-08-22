import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SubscriptionController } from "../../service";

export const getSubscription = createAdminEndpoint(
	"/admin/subscriptions/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.subscriptions as SubscriptionController;
		const subscription = await controller.getSubscription(ctx.params.id);
		return { subscription };
	},
);
