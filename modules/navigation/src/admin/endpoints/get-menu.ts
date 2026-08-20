import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { NavigationController } from "../../service";

export const adminGetMenuEndpoint = createAdminEndpoint(
	"/admin/navigation/menus/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.navigation as NavigationController;
		const menu = await controller.getMenuWithItems(ctx.params.id);
		return { menu };
	},
);
