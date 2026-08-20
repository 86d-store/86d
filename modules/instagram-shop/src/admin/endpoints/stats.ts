import { createAdminEndpoint } from "@86d-app/core/api";
import type { InstagramShopController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/instagram-shop/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.instagramShop as InstagramShopController;
		const stats = await controller.getChannelStats();
		return { stats };
	},
);
