import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { LoyaltyController } from "../../service";

export const updateRule = createAdminEndpoint(
	"/admin/loyalty/rules/:id/update",
	{
		method: "PUT",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			name: z.string().max(200).transform(sanitizeText).optional(),
			points: z.number().min(0).optional(),
			minOrderAmount: z.number().min(0).optional(),
			active: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const rule = await controller.updateRule(ctx.params.id, {
			name: ctx.body.name,
			points: ctx.body.points,
			minOrderAmount: ctx.body.minOrderAmount,
			active: ctx.body.active,
		});
		if (!rule) {
			return { error: "Rule not found" };
		}
		return { rule };
	},
);
