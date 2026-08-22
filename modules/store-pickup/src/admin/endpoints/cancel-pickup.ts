import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { StorePickupController } from "../../service";

export const cancelPickup = createAdminEndpoint(
	"/admin/store-pickup/pickups/:id/cancel",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		try {
			const pickup = await controller.cancelPickup(ctx.params.id);
			if (!pickup) {
				return { error: "Pickup not found", status: 404 };
			}
			return { pickup };
		} catch {
			return { error: "Failed to cancel pickup", status: 400 };
		}
	},
);
