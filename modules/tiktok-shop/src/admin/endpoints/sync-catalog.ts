import { createAdminEndpoint } from "@86d-app/core/api";
import type { TikTokShopController } from "../../service";

export const syncCatalogEndpoint = createAdminEndpoint(
	"/admin/tiktok-shop/sync",
	{
		method: "POST",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.tiktokShop as TikTokShopController;
		const sync = await controller.syncCatalog();
		return { sync };
	},
);
