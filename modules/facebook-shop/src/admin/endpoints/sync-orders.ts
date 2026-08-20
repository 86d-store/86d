import { createAdminEndpoint } from "@86d-app/core/api";
import type { FacebookShopController } from "../../service";

export const syncOrdersEndpoint = createAdminEndpoint(
	"/admin/facebook-shop/orders/sync",
	{
		method: "POST",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.facebookShop as FacebookShopController;
		const result = await controller.syncOrders();
		return result;
	},
);
