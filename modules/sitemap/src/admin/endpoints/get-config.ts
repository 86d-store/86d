import { createAdminEndpoint } from "@86d-app/core/api";
import type { SitemapController } from "../../service";

export const getConfig = createAdminEndpoint(
	"/admin/sitemap/config",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.sitemap as SitemapController;
		const config = await controller.getConfig();

		return { config };
	},
);
