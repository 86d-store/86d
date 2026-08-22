import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ShippingController } from "../../service";

export const getShipment = createAdminEndpoint(
	"/admin/shipping/shipments/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const shipment = await controller.getShipment(ctx.params.id);
		if (!shipment) return { error: "Shipment not found", status: 404 };

		const trackingUrl = await controller.getTrackingUrl(shipment.id);
		return { shipment, trackingUrl };
	},
);
