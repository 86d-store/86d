import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { TikTokShopController } from "../../service";

export const pushProductEndpoint = createAdminEndpoint(
	"/admin/tiktok-shop/listings/:id/push",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.tiktokShop as TikTokShopController;
		const listing = await controller.pushProduct(ctx.params.id);
		return { listing };
	},
);
