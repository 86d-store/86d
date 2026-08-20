import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { SubscriptionController } from "../../service";

export const createPlan = createAdminEndpoint(
	"/admin/subscriptions/plans/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			description: z.string().max(2000).transform(sanitizeText).optional(),
			price: z.number().int().min(0),
			currency: z.string().max(3).optional(),
			interval: z.enum(["day", "week", "month", "year"]),
			intervalCount: z.number().int().min(1).optional(),
			trialDays: z.number().int().min(0).optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.subscriptions as SubscriptionController;
		const plan = await controller.createPlan({
			name: ctx.body.name,
			description: ctx.body.description,
			price: ctx.body.price,
			currency: ctx.body.currency,
			interval: ctx.body.interval,
			intervalCount: ctx.body.intervalCount,
			trialDays: ctx.body.trialDays,
			isActive: ctx.body.isActive,
		});
		return { plan };
	},
);
