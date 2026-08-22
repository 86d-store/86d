import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ShippingController } from "../../service";

export const deleteShipment = createAdminEndpoint(
	"/admin/shipping/shipments/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const deleted = await controller.deleteShipment(ctx.params.id);
		if (!deleted) return { error: "Shipment not found", status: 404 };
		return { success: true };
	},
);
