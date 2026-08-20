import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { StorePickupController } from "../../service";

export const getLocation = createAdminEndpoint(
	"/admin/store-pickup/locations/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const location = await controller.getLocation(ctx.params.id);
		if (!location) {
			return { error: "Location not found", status: 404 };
		}
		return { location };
	},
);
