import { createAdminEndpoint } from "@86d-app/core/api";
import type { SearchController } from "../../service";

export const analyticsEndpoint = createAdminEndpoint(
	"/admin/search/analytics",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers.search as SearchController;
		const [analytics, indexCount] = await Promise.all([
			controller.getAnalytics(),
			controller.getIndexCount(),
		]);
		return { analytics: { ...analytics, indexedItems: indexCount } };
	},
);
