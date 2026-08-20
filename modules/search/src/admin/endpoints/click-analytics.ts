import { createAdminEndpoint } from "@86d-app/core/api";
import type { SearchController } from "../../service";

export const clickAnalyticsEndpoint = createAdminEndpoint(
	"/admin/search/clicks",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers.search as SearchController;
		const analytics = await controller.getAnalytics();

		return {
			clickThroughRate: analytics.clickThroughRate,
			avgClickPosition: analytics.avgClickPosition,
		};
	},
);
