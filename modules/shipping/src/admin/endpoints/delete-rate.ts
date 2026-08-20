import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ShippingController } from "../../service";

export const deleteRate = createAdminEndpoint(
	"/admin/shipping/rates/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const deleted = await controller.deleteRate(ctx.params.id);
		if (!deleted) return { error: "Shipping rate not found", status: 404 };
		return { success: true };
	},
);
