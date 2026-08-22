import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MenuLocation, NavigationController } from "../../service";

export const listMenusEndpoint = createStoreEndpoint(
	"/navigation",
	{
		method: "GET",
		query: z.object({
			location: z
				.enum(["header", "footer", "sidebar", "mobile", "custom"])
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.navigation as NavigationController;
		const menus = await controller.listMenus({
			isActive: true,
			...(ctx.query.location
				? { location: ctx.query.location as MenuLocation }
				: {}),
		});
		return { menus };
	},
);
