import { createStoreEndpoint } from "@86d-app/core/api";
import type { SeoController } from "../../service";

export const getSitemapEndpoint = createStoreEndpoint(
	"/seo/sitemap",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.seo as SeoController;
		const entries = await controller.getSitemapEntries();
		return { entries };
	},
);
