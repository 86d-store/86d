import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ListLocationsParams, StorePickupController } from "../../service";

export const listLocations = createAdminEndpoint(
	"/admin/store-pickup/locations",
	{
		method: "GET",
		query: z.object({
			active: z.coerce.boolean().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const params: ListLocationsParams = {};
		if (ctx.query.active != null) params.active = ctx.query.active;
		if (ctx.query.take != null) params.take = ctx.query.take;
		if (ctx.query.skip != null) params.skip = ctx.query.skip;
		const locations = await controller.listLocations(params);
		return { locations };
	},
);
