import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { NavigationController } from "../../service";

export const deleteItemEndpoint = createAdminEndpoint(
	"/admin/navigation/items/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.navigation as NavigationController;
		const deleted = await controller.deleteItem(ctx.params.id);
		return { deleted };
	},
);
