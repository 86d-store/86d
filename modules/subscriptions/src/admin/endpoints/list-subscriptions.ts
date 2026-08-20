import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SubscriptionController } from "../../service";

export const listSubscriptions = createAdminEndpoint(
	"/admin/subscriptions",
	{
		method: "GET",
		query: z.object({
			email: z.string().optional(),
			planId: z.string().optional(),
			status: z
				.enum(["active", "trialing", "cancelled", "expired", "past_due"])
				.optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.subscriptions as SubscriptionController;
		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;
		const all = await controller.listSubscriptions({
			email: ctx.query.email,
			planId: ctx.query.planId,
			status: ctx.query.status,
		});
		const total = all.length;
		const subscriptions = all.slice(skip, skip + take);
		return { subscriptions, total };
	},
);
