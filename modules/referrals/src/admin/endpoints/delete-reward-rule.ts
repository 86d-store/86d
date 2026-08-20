import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ReferralController } from "../../service";

export const deleteRewardRuleEndpoint = createAdminEndpoint(
	"/admin/referrals/rules/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.referrals as ReferralController;
		const deleted = await controller.deleteRewardRule(ctx.params.id);
		return { success: deleted };
	},
);
