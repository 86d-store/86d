import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { StoreLocatorController } from "../../service";

export const getLocation = createAdminEndpoint(
	"/admin/store-locator/locations/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storeLocator as StoreLocatorController;

		const location = await controller.getLocation(ctx.params.id);
		if (!location) {
			return { error: "Location not found", status: 404 };
		}

		return { location };
	},
);
