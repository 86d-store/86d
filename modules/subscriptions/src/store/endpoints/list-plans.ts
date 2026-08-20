import { createStoreEndpoint } from "@86d-app/core/api";
import type { SubscriptionController } from "../../service";

export const storePlans = createStoreEndpoint(
	"/subscriptions/plans",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.subscriptions as SubscriptionController;
		const plans = await controller.listPlans({ activeOnly: true });
		return { plans };
	},
);
