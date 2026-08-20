import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { StorePickupController } from "../../service";

export const deleteBlackout = createAdminEndpoint(
	"/admin/store-pickup/blackouts/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const deleted = await controller.deleteBlackout(ctx.params.id);
		if (!deleted) {
			return { error: "Blackout not found", status: 404 };
		}
		return { success: true };
	},
);
