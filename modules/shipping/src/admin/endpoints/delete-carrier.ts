import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ShippingController } from "../../service";

export const deleteCarrier = createAdminEndpoint(
	"/admin/shipping/carriers/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const deleted = await controller.deleteCarrier(ctx.params.id);
		if (!deleted) return { error: "Shipping carrier not found", status: 404 };
		return { success: true };
	},
);
