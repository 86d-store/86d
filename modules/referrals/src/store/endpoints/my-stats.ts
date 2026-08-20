import { createStoreEndpoint } from "@86d-app/core/api";
import type { ReferralController } from "../../service";

export const myStatsEndpoint = createStoreEndpoint(
	"/referrals/my-stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) return { error: "Not authenticated", status: 401 };

		const controller = ctx.context.controllers.referrals as ReferralController;
		const stats = await controller.getStatsForCustomer(customerId);
		return stats;
	},
);
