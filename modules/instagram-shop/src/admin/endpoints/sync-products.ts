import { createAdminEndpoint } from "@86d-app/core/api";
import type { InstagramShopController } from "../../service";

export const syncProductsEndpoint = createAdminEndpoint(
	"/admin/instagram-shop/products/sync",
	{
		method: "POST",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.instagramShop as InstagramShopController;
		const result = await controller.syncProducts();
		return result;
	},
);
