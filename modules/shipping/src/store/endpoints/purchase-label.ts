import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ShippingController } from "../../service";

export const purchaseLabelEndpoint = createStoreEndpoint(
	"/shipping/purchase-label",
	{
		method: "POST",
		body: z.object({
			shipmentId: z.string().min(1).max(100),
			easypostShipmentId: z.string().min(1).max(200),
			easypostRateId: z.string().min(1).max(200),
			insurance: z.string().max(50).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const shipment = await controller.purchaseLabel({
			shipmentId: ctx.body.shipmentId,
			easypostShipmentId: ctx.body.easypostShipmentId,
			easypostRateId: ctx.body.easypostRateId,
			insurance: ctx.body.insurance,
		});
		return { shipment };
	},
);
