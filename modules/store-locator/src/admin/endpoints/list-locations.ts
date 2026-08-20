import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { StoreLocatorController } from "../../service";

export const listLocations = createAdminEndpoint(
	"/admin/store-locator/locations",
	{
		method: "GET",
		query: z
			.object({
				country: z.string().optional(),
				region: z.string().optional(),
				city: z.string().optional(),
				active: z.string().optional(),
				pickup: z.string().optional(),
				featured: z.string().optional(),
				limit: z.string().optional(),
				offset: z.string().optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const { query = {} } = ctx;
		const controller = ctx.context.controllers
			.storeLocator as StoreLocatorController;

		const locations = await controller.listLocations({
			activeOnly: query.active === "true",
			country: query.country,
			region: query.region,
			city: query.city,
			pickupOnly: query.pickup === "true",
			featuredOnly: query.featured === "true",
			limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
			offset: query.offset ? Number.parseInt(query.offset, 10) : undefined,
		});

		return { locations, total: locations.length };
	},
);
