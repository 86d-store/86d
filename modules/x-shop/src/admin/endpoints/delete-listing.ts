import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { XShopController } from "../../service";

export const deleteListingEndpoint = createAdminEndpoint(
	"/admin/x-shop/listings/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.xShop as XShopController;
		const deleted = await controller.deleteListing(ctx.params.id);
		return { deleted };
	},
);
