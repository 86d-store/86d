import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AmazonController } from "../../service";

export const cancelOrderEndpoint = createAdminEndpoint(
	"/admin/amazon/orders/:id/cancel",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.amazon as AmazonController;
		const order = await controller.cancelOrder(ctx.params.id);
		return { order };
	},
);
