import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { MenuLocation, NavigationController } from "../../service";

export const getByLocationEndpoint = createStoreEndpoint(
	"/navigation/location/:location",
	{
		method: "GET",
		params: z.object({
			location: z.enum(["header", "footer", "sidebar", "mobile", "custom"]),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.navigation as NavigationController;
		const menu = await controller.getMenuByLocation(
			ctx.params.location as MenuLocation,
		);
		return { menu };
	},
);
