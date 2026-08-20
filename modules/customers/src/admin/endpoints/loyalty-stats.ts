import { createAdminEndpoint } from "@86d-app/core/api";
import type { CustomerController } from "../../service";

export const adminGetLoyaltyStats = createAdminEndpoint(
	"/admin/customers/loyalty/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.customer as CustomerController;
		const stats = await controller.getLoyaltyStats();
		return { stats };
	},
);
