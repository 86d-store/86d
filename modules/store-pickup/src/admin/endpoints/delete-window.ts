import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { StorePickupController } from "../../service";

export const deleteWindow = createAdminEndpoint(
	"/admin/store-pickup/windows/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const deleted = await controller.deleteWindow(ctx.params.id);
		if (!deleted) {
			return { error: "Window not found", status: 404 };
		}
		return { success: true };
	},
);
