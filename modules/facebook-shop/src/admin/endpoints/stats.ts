import { createAdminEndpoint } from "@86d-app/core/api";
import type { FacebookShopController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/facebook-shop/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.facebookShop as FacebookShopController;
		const stats = await controller.getChannelStats();
		return { stats };
	},
);
