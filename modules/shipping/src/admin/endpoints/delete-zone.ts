import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ShippingController } from "../../service";

export const deleteZone = createAdminEndpoint(
	"/admin/shipping/zones/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const deleted = await controller.deleteZone(ctx.params.id);
		if (!deleted) return { error: "Shipping zone not found", status: 404 };
		return { success: true };
	},
);
