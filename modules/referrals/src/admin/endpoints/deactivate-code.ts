import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ReferralController } from "../../service";

export const deactivateCodeEndpoint = createAdminEndpoint(
	"/admin/referrals/codes/:id/deactivate",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.referrals as ReferralController;
		const code = await controller.deactivateCode(ctx.params.id);
		if (!code) return { error: "Referral code not found" };
		return { code };
	},
);
