import { createAdminEndpoint } from "@86d-app/core/api";
import type { PinterestShopController } from "../../service";

export const syncCatalogEndpoint = createAdminEndpoint(
	"/admin/pinterest-shop/sync",
	{
		method: "POST",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.pinterestShop as PinterestShopController;
		const sync = await controller.syncCatalog();
		return { sync };
	},
);
