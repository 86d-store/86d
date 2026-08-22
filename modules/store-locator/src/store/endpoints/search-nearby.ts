import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { StoreLocatorController } from "../../service";

export const searchNearby = createStoreEndpoint(
	"/locations/nearby",
	{
		method: "GET",
		query: z.object({
			lat: z.string().max(20),
			lng: z.string().max(20),
			radius: z.string().max(10).optional(),
			unit: z.enum(["km", "mi"]).optional(),
			limit: z.string().max(5).optional(),
			pickup: z.string().max(5).optional(),
		}),
	},
	async (ctx) => {
		const { query } = ctx;
		const controller = ctx.context.controllers
			.storeLocator as StoreLocatorController;

		const latitude = Number.parseFloat(query.lat);
		const longitude = Number.parseFloat(query.lng);

		if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
			return { error: "Invalid coordinates", status: 400 };
		}

		if (latitude < -90 || latitude > 90) {
			return { error: "Latitude must be between -90 and 90", status: 400 };
		}

		if (longitude < -180 || longitude > 180) {
			return { error: "Longitude must be between -180 and 180", status: 400 };
		}

		const results = await controller.searchNearby({
			latitude,
			longitude,
			radiusKm: query.radius ? Number.parseFloat(query.radius) : undefined,
			unit: query.unit,
			limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
			pickupOnly: query.pickup === "true",
		});

		return { locations: results };
	},
);
