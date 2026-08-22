import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { StoreLocatorController } from "../../service";

export const getLocation = createStoreEndpoint(
	"/locations/:slug",
	{
		method: "GET",
		params: z.object({
			slug: z.string().max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storeLocator as StoreLocatorController;

		const location = await controller.getLocationBySlug(ctx.params.slug);
		if (!location?.isActive) {
			return { error: "Location not found", status: 404 };
		}

		return { location };
	},
);
