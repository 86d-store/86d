import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { ShippingController } from "../../service";

export const updateShipment = createAdminEndpoint(
	"/admin/shipping/shipments/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			carrierId: z.string().optional(),
			methodId: z.string().optional(),
			trackingNumber: z.string().max(200).transform(sanitizeText).optional(),
			estimatedDelivery: z.coerce.date().optional(),
			notes: z.string().max(2000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const shipment = await controller.updateShipment(ctx.params.id, {
			carrierId: ctx.body.carrierId,
			methodId: ctx.body.methodId,
			trackingNumber: ctx.body.trackingNumber,
			estimatedDelivery: ctx.body.estimatedDelivery,
			notes: ctx.body.notes,
		});
		if (!shipment) return { error: "Shipment not found", status: 404 };
		return { shipment };
	},
);
