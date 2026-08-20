import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SitemapController } from "../../service";

export const getSitemapIndex = createStoreEndpoint(
	"/sitemap-index.xml",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.sitemap as SitemapController;
		const xml = await controller.generateSitemapIndex();

		if (!xml) {
			// All entries fit in a single sitemap, redirect to it
			return {
				body: "",
				status: 302,
				headers: { Location: "/api/sitemap.xml" },
			};
		}

		return {
			body: xml,
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
				"Cache-Control": "public, max-age=3600, s-maxage=3600",
			},
		};
	},
);

export const getSitemapPage = createStoreEndpoint(
	"/sitemap-page.xml",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().min(0).max(1000),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.sitemap as SitemapController;
		const xml = await controller.generateXml(ctx.query.page);

		return {
			body: xml,
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
				"Cache-Control": "public, max-age=3600, s-maxage=3600",
			},
		};
	},
);
