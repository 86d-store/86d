import { createStoreEndpoint } from "@86d-app/core/api";
import type { SitemapController } from "../../service";

export const getPublicStats = createStoreEndpoint(
	"/sitemap/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.sitemap as SitemapController;
		const stats = await controller.getStats();

		return {
			totalEntries: stats.totalEntries,
			lastGenerated: stats.lastGenerated,
		};
	},
);
