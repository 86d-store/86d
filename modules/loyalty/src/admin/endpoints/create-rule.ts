import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { LoyaltyController } from "../../service";

export const createRule = createAdminEndpoint(
	"/admin/loyalty/rules/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().max(200).transform(sanitizeText),
			type: z.enum(["per_dollar", "fixed_bonus", "multiplier", "signup"]),
			points: z.number().min(0),
			minOrderAmount: z.number().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const rule = await controller.createRule({
			name: ctx.body.name,
			type: ctx.body.type,
			points: ctx.body.points,
			minOrderAmount: ctx.body.minOrderAmount,
		});
		return { rule };
	},
);
