import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ReferralController } from "../../service";

export const revokeReferralEndpoint = createAdminEndpoint(
	"/admin/referrals/:id/revoke",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.referrals as ReferralController;
		const referral = await controller.revokeReferral(ctx.params.id);
		if (!referral) return { error: "Cannot revoke referral" };
		return { referral };
	},
);
