import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ReferralController } from "../../service";

export const listRewardRulesEndpoint = createAdminEndpoint(
	"/admin/referrals/rules",
	{
		method: "GET",
		query: z.object({
			active: z
				.enum(["true", "false"])
				.transform((v) => v === "true")
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.referrals as ReferralController;
		const rules = await controller.listRewardRules({
			active: ctx.query.active,
		});
		return { rules };
	},
);
