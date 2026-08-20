import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InstagramShopController } from "../../service";

export const getOrderEndpoint = createAdminEndpoint(
	"/admin/instagram-shop/orders/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.instagramShop as InstagramShopController;
		const order = await controller.getOrder(ctx.params.id);
		if (!order) {
			return { error: "Order not found" };
		}
		return { order };
	},
);
