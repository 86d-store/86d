import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { StorePickupController } from "../../service";

export const getPickup = createAdminEndpoint(
	"/admin/store-pickup/pickups/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const pickup = await controller.getPickup(ctx.params.id);
		if (!pickup) {
			return { error: "Pickup not found", status: 404 };
		}
		return { pickup };
	},
);
