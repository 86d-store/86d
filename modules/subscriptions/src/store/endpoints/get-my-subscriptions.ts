import { createStoreEndpoint } from "@86d-app/core/api";
import type { SubscriptionController } from "../../service";

export const getMySubscriptions = createStoreEndpoint(
	"/subscriptions/me",
	{
		method: "GET",
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers
			.subscriptions as SubscriptionController;
		const subscriptions = await controller.listSubscriptions({
			email: session.user.email,
		});

		// Enrich each subscription with its plan name for display.
		const planIds = [...new Set(subscriptions.map((s) => s.planId))];
		const planMap = new Map<string, string>();
		await Promise.all(
			planIds.map(async (planId) => {
				const plan = await controller.getPlan(planId);
				if (plan) planMap.set(planId, plan.name);
			}),
		);

		const enriched = subscriptions.map((s) => ({
			...s,
			planName: planMap.get(s.planId),
		}));

		return { subscriptions: enriched };
	},
);
