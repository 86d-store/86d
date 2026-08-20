import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { NavigationController } from "../../service";

export const reorderItemsEndpoint = createAdminEndpoint(
	"/admin/navigation/menus/:menuId/reorder",
	{
		method: "POST",
		params: z.object({ menuId: z.string() }),
		body: z.object({
			itemIds: z.array(z.string()).min(1),
			parentId: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.navigation as NavigationController;
		await controller.reorderItems(
			ctx.params.menuId,
			ctx.body.itemIds,
			ctx.body.parentId,
		);
		return { reordered: true };
	},
);
