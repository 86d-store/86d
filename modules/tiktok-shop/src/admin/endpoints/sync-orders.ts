import { createAdminEndpoint } from "@86d-app/core/api";
import type { TikTokShopController } from "../../service";

export const syncOrdersEndpoint = createAdminEndpoint(
	"/admin/tiktok-shop/orders/sync",
	{
		method: "POST",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.tiktokShop as TikTokShopController;
		const result = await controller.syncOrders();
		return result;
	},
);
