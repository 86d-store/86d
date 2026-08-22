import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { NavigationController } from "../../service";

export const getMenuEndpoint = createStoreEndpoint(
	"/navigation/:slug",
	{
		method: "GET",
		params: z.object({ slug: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.navigation as NavigationController;
		const menu = await controller.getMenuBySlug(ctx.params.slug);
		if (!menu?.isActive) {
			return { menu: null };
		}
		const withItems = await controller.getMenuWithItems(menu.id);
		return { menu: withItems };
	},
);
