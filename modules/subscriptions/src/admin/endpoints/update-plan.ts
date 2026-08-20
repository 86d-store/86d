import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { SubscriptionController } from "../../service";

export const updatePlan = createAdminEndpoint(
	"/admin/subscriptions/plans/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			description: z.string().max(2000).transform(sanitizeText).optional(),
			price: z.number().int().min(0).optional(),
			trialDays: z.number().int().min(0).optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.subscriptions as SubscriptionController;
		const plan = await controller.updatePlan(ctx.params.id, {
			name: ctx.body.name,
			description: ctx.body.description,
			price: ctx.body.price,
			trialDays: ctx.body.trialDays,
			isActive: ctx.body.isActive,
		});
		return { plan };
	},
);
