import { createAdminEndpoint } from "@86d-app/core/api";
import type { FacebookShopController } from "../../service";

export const syncProductsEndpoint = createAdminEndpoint(
	"/admin/facebook-shop/products/sync",
	{
		method: "POST",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.facebookShop as FacebookShopController;
		const result = await controller.syncProducts();
		return result;
	},
);
