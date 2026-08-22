import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { OrderController } from "../../service";

export const adminListOrderReturns = createAdminEndpoint(
	"/admin/orders/:id/returns",
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

		const returns = await controller.listReturns(ctx.params.id);

		return { returns };
	},
);
