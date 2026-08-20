import { createAdminEndpoint } from "@86d-app/core/api";
import type { SitemapController } from "../../service";

export const getStats = createAdminEndpoint(
	"/admin/sitemap/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.sitemap as SitemapController;
		const stats = await controller.getStats();

		return { stats };
	},
);
