import { createStoreEndpoint } from "@86d-app/core/api";
import type { SitemapController } from "../../service";

export const getSitemap = createStoreEndpoint(
	"/sitemap.xml",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.sitemap as SitemapController;
		const xml = await controller.generateXml();

		return {
			body: xml,
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
				"Cache-Control": "public, max-age=3600, s-maxage=3600",
			},
		};
	},
);
