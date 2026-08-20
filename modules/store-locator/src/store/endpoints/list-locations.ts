import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { StoreLocatorController } from "../../service";

export const listLocations = createStoreEndpoint(
	"/locations",
	{
		method: "GET",
		query: z
			.object({
				country: z.string().max(10).transform(sanitizeText).optional(),
				region: z.string().max(200).transform(sanitizeText).optional(),
				city: z.string().max(200).transform(sanitizeText).optional(),
				pickup: z.string().max(5).optional(),
				featured: z.string().max(5).optional(),
				limit: z.string().max(5).optional(),
				offset: z.string().max(10).optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const { query = {} } = ctx;
		const controller = ctx.context.controllers
			.storeLocator as StoreLocatorController;

		const locations = await controller.listLocations({
			activeOnly: true,
			country: query.country,
			region: query.region,
			city: query.city,
			pickupOnly: query.pickup === "true",
			featuredOnly: query.featured === "true",
			limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
			offset: query.offset ? Number.parseInt(query.offset, 10) : undefined,
		});

		return { locations };
	},
);
