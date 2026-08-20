import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ReferralController } from "../../service";

export const getCodeEndpoint = createAdminEndpoint(
	"/admin/referrals/codes/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.referrals as ReferralController;
		const code = await controller.getCode(ctx.params.id);
		if (!code) return { error: "Referral code not found" };
		return { code };
	},
);
