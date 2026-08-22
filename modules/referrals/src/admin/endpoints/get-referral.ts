import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ReferralController } from "../../service";

export const getReferralEndpoint = createAdminEndpoint(
	"/admin/referrals/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.referrals as ReferralController;
		const referral = await controller.getReferral(ctx.params.id);
		if (!referral) return { error: "Referral not found" };
		return { referral };
	},
);
