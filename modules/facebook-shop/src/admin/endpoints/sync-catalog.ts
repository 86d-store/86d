import { createAdminEndpoint } from "@86d-app/core/api";
import type { FacebookShopController } from "../../service";

export const syncCatalogEndpoint = createAdminEndpoint(
	"/admin/facebook-shop/sync",
	{
		method: "POST",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.facebookShop as FacebookShopController;
		const sync = await controller.syncCatalog();
		return { sync };
	},
);
