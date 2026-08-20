import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { TikTokShopController } from "../../service";

export const deleteListingEndpoint = createAdminEndpoint(
	"/admin/tiktok-shop/listings/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.tiktokShop as TikTokShopController;
		const deleted = await controller.deleteListing(ctx.params.id);
		return { deleted };
	},
);
