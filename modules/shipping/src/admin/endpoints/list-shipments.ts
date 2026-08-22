import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ShippingController } from "../../service";

export const listShipments = createAdminEndpoint(
	"/admin/shipping/shipments",
	{
		method: "GET",
		query: z.object({
			orderId: z.string().optional(),
			status: z
				.enum([
					"pending",
					"shipped",
					"in_transit",
					"delivered",
					"returned",
					"failed",
				])
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const shipments = await controller.listShipments({
			orderId: ctx.query.orderId,
			status: ctx.query.status,
		});
		return { shipments };
	},
);
