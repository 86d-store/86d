import { createAdminEndpoint } from "@86d-app/core/api";
import type { ProductFeedsController } from "../../service";

export const getStats = createAdminEndpoint(
	"/admin/product-feeds/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productFeeds as ProductFeedsController;
		const stats = await controller.getStats();
		return { stats };
	},
);
