import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { StorePickupController } from "../../service";

export const listBlackoutsAdmin = createAdminEndpoint(
	"/admin/store-pickup/blackouts",
	{
		method: "GET",
		query: z.object({
			locationId: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const blackouts = await controller.listBlackouts(ctx.query.locationId);
		return { blackouts };
	},
);
