import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { XShopController } from "../../service";

export const dropStatsEndpoint = createAdminEndpoint(
	"/admin/x-shop/drops/:id/stats",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.xShop as XShopController;
		const stats = await controller.getDropStats(ctx.params.id);
		if (!stats) {
			return { error: "Drop not found" };
		}
		return { stats };
	},
);
