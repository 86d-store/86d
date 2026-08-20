import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { XShopController } from "../../service";

export const getListingEndpoint = createAdminEndpoint(
	"/admin/x-shop/listings/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.xShop as XShopController;
		const listing = await controller.getListing(ctx.params.id);
		if (!listing) {
			return { error: "Listing not found" };
		}
		return { listing };
	},
);
