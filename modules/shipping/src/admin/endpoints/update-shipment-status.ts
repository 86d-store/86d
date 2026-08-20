import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ShippingController } from "../../service";

export const updateShipmentStatus = createAdminEndpoint(
	"/admin/shipping/shipments/:id/status",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			status: z.enum([
				"pending",
				"shipped",
				"in_transit",
				"delivered",
				"returned",
				"failed",
			]),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const shipment = await controller.updateShipmentStatus(
			ctx.params.id,
			ctx.body.status,
		);
		if (!shipment)
			return {
				error: "Shipment not found or invalid status transition",
				status: 400,
			};
		return { shipment };
	},
);
