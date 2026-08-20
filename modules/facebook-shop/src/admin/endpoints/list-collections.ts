import { createAdminEndpoint } from "@86d-app/core/api";
import type { FacebookShopController } from "../../service";

export const listCollectionsEndpoint = createAdminEndpoint(
	"/admin/facebook-shop/collections",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.facebookShop as FacebookShopController;
		const collections = await controller.listCollections();
		return { collections, total: collections.length };
	},
);
