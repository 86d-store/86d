import { createAdminEndpoint } from "@86d-store/core/api";
import type { SitemapController } from "../../service";

export const previewSitemap = createAdminEndpoint(
	"/admin/sitemap/preview",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.sitemap as SitemapController;
		const xml = await controller.generateXml();

		return { xml };
	},
);
