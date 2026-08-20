import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { OrderController } from "../../service";

export const adminGetOrder = createAdminEndpoint(
	"/admin/orders/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.order as OrderController;
		const order = await controller.getById(ctx.params.id);
		if (!order) {
			return { error: "Order not found", status: 404 };
		}
		return { order };
	},
);
