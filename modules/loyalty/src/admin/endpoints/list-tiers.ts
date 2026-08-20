import { createAdminEndpoint } from "@86d-app/core/api";
import type { LoyaltyController } from "../../service";

export const listTiers = createAdminEndpoint(
	"/admin/loyalty/tiers",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const tiers = await controller.listTiers();
		return { tiers };
	},
);
