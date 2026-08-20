import { createAdminEndpoint } from "@86d-app/core/api";
import type { InstagramShopController } from "../../service";

export const syncCatalogEndpoint = createAdminEndpoint(
	"/admin/instagram-shop/sync",
	{
		method: "POST",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.instagramShop as InstagramShopController;
		const sync = await controller.syncCatalog();
		return { sync };
	},
);
