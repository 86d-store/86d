import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FulfillmentController } from "../../service";

export const listByOrder = createAdminEndpoint(
	"/admin/fulfillment/order/:orderId",
	{
		method: "GET",
		params: z.object({ orderId: z.string().min(1) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.fulfillment as FulfillmentController;
		const fulfillments = await controller.listByOrder(ctx.params.orderId);
		return { fulfillments };
	},
);
