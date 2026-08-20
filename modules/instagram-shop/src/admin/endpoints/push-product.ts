import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InstagramShopController } from "../../service";

export const pushProductEndpoint = createAdminEndpoint(
	"/admin/instagram-shop/listings/:id/push",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.instagramShop as InstagramShopController;
		const listing = await controller.pushProduct(ctx.params.id);
		return { listing };
	},
);
