import { createAdminEndpoint } from "@86d-app/core/api";
import type { PinterestShopController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/pinterest-shop/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.pinterestShop as PinterestShopController;
		const stats = await controller.getChannelStats();
		return { stats };
	},
);
