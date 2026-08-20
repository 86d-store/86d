import { createAdminEndpoint } from "@86d-app/core/api";
import type { TikTokShopController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/tiktok-shop/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.tiktokShop as TikTokShopController;
		const stats = await controller.getChannelStats();
		return { stats };
	},
);
