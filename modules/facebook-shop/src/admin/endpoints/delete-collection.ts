import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FacebookShopController } from "../../service";

export const deleteCollectionEndpoint = createAdminEndpoint(
	"/admin/facebook-shop/collections/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.facebookShop as FacebookShopController;
		const deleted = await controller.deleteCollection(ctx.params.id);
		return { deleted };
	},
);
