import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { XShopController } from "../../service";

export const getOrderEndpoint = createAdminEndpoint(
	"/admin/x-shop/orders/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.xShop as XShopController;
		const order = await controller.getOrder(ctx.params.id);
		if (!order) {
			return { error: "Order not found" };
		}
		return { order };
	},
);
