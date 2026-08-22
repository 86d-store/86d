import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PinterestShopController } from "../../service";

export const getCatalogItemEndpoint = createAdminEndpoint(
	"/admin/pinterest-shop/items/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.pinterestShop as PinterestShopController;
		const item = await controller.getCatalogItem(ctx.params.id);
		return { item };
	},
);
