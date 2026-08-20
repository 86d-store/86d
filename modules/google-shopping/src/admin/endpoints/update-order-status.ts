import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GoogleShoppingController, OrderStatus } from "../../service";

export const updateOrderStatusEndpoint = createAdminEndpoint(
	"/admin/google-shopping/orders/:id/status",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			status: z.enum([
				"pending",
				"confirmed",
				"shipped",
				"delivered",
				"cancelled",
				"returned",
			]),
			trackingNumber: z.string().max(200).optional(),
			carrier: z.string().max(200).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"google-shopping"
		] as GoogleShoppingController;
		const order = await controller.updateOrderStatus(
			ctx.params.id,
			ctx.body.status as OrderStatus,
			ctx.body.trackingNumber,
			ctx.body.carrier,
		);
		return { order };
	},
);
