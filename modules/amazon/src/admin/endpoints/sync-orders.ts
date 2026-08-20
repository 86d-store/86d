import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AmazonController } from "../../service";

export const syncOrdersEndpoint = createAdminEndpoint(
	"/admin/amazon/orders/sync",
	{
		method: "POST",
		body: z
			.object({
				createdAfter: z.string().max(50).optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.amazon as AmazonController;
		const result = await controller.syncOrders({
			createdAfter: ctx.body?.createdAfter,
		});
		return result;
	},
);
