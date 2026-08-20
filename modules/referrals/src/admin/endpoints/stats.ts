import { createAdminEndpoint } from "@86d-app/core/api";
import type { ReferralController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/referrals/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.referrals as ReferralController;
		const stats = await controller.getStats();
		return { stats };
	},
);
