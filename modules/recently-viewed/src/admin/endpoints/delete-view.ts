import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { RecentlyViewedController } from "../../service";

export const deleteView = createAdminEndpoint(
	"/admin/recently-viewed/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.recentlyViewed as RecentlyViewedController;

		const deleted = await controller.deleteView(ctx.params.id);
		if (!deleted) {
			return { error: "View not found", status: 404 };
		}
		return { success: true };
	},
);
