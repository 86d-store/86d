import { createAdminEndpoint } from "@86d-app/core/api";
import type { InstagramShopController } from "../../service";

export const syncOrdersEndpoint = createAdminEndpoint(
	"/admin/instagram-shop/orders/sync",
	{
		method: "POST",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.instagramShop as InstagramShopController;
		const result = await controller.syncOrders();
		return result;
	},
);
