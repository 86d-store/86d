import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { ReferralController } from "../../service";

export const createRewardRuleEndpoint = createAdminEndpoint(
	"/admin/referrals/rules/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().max(200).transform(sanitizeText),
			referrerRewardType: z.enum([
				"percentage_discount",
				"fixed_discount",
				"store_credit",
			]),
			referrerRewardValue: z.number().min(0),
			refereeRewardType: z.enum([
				"percentage_discount",
				"fixed_discount",
				"store_credit",
			]),
			refereeRewardValue: z.number().min(0),
			minOrderAmount: z.number().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.referrals as ReferralController;
		const rule = await controller.createRewardRule(ctx.body);
		return { rule };
	},
);
