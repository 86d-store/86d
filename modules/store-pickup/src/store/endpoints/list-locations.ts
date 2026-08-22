import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ListLocationsParams, StorePickupController } from "../../service";

export const listLocationsStore = createStoreEndpoint(
	"/store-pickup/locations",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const params: ListLocationsParams = { active: true };
		if (ctx.query.take != null) params.take = ctx.query.take;
		if (ctx.query.skip != null) params.skip = ctx.query.skip;
		const locations = await controller.listLocations(params);
		return { locations };
	},
);
