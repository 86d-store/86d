import { createAdminEndpoint } from "@86d-store/core/api";
import type { TikTokShopController } from "../../service";

export const syncProductsEndpoint = createAdminEndpoint(
	"/admin/tiktok-shop/products/sync",
	{
		method: "POST",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.tiktokShop as TikTokShopController;
		const result = await controller.syncProducts();
		return result;
	},
);
