import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { WalmartController } from "../../service";

export const cancelOrderEndpoint = createAdminEndpoint(
	"/admin/walmart/orders/:id/cancel",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.walmart as WalmartController;
		const order = await controller.cancelOrder(ctx.params.id);
		return { order };
	},
);
