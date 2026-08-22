import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { ReferralController } from "../../service";

export const updateRewardRuleEndpoint = createAdminEndpoint(
	"/admin/referrals/rules/:id/update",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().max(200).transform(sanitizeText).optional(),
			referrerRewardType: z
				.enum(["percentage_discount", "fixed_discount", "store_credit"])
				.optional(),
			referrerRewardValue: z.number().min(0).optional(),
			refereeRewardType: z
				.enum(["percentage_discount", "fixed_discount", "store_credit"])
				.optional(),
			refereeRewardValue: z.number().min(0).optional(),
			minOrderAmount: z.number().min(0).optional(),
			active: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.referrals as ReferralController;
		const rule = await controller.updateRewardRule(ctx.params.id, ctx.body);
		if (!rule) return { error: "Reward rule not found" };
		return { rule };
	},
);
