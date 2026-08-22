import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { NavigationController } from "../../service";

export const deleteMenuEndpoint = createAdminEndpoint(
	"/admin/navigation/menus/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.navigation as NavigationController;
		const deleted = await controller.deleteMenu(ctx.params.id);
		return { deleted };
	},
);
