import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SitemapController } from "../../service";

const changeFreqValues = [
	"always",
	"hourly",
	"daily",
	"weekly",
	"monthly",
	"yearly",
	"never",
] as const;

export const bulkAddEntries = createAdminEndpoint(
	"/admin/sitemap/entries/bulk-add",
	{
		method: "POST",
		body: z.object({
			entries: z
				.array(
					z.object({
						path: z.string().min(1).max(2000),
						changefreq: z.enum(changeFreqValues).optional(),
						priority: z.number().min(0).max(1).optional(),
						lastmod: z.coerce.date().optional(),
					}),
				)
				.min(1)
				.max(500),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.sitemap as SitemapController;

		const entries = await controller.bulkAddEntries(
			ctx.body.entries.map((e) => {
				const params: Parameters<typeof controller.addEntry>[0] = {
					path: e.path,
				};
				if (e.changefreq != null) params.changefreq = e.changefreq;
				if (e.priority != null) params.priority = e.priority;
				if (e.lastmod != null) params.lastmod = e.lastmod;
				return params;
			}),
		);

		return { entries, count: entries.length };
	},
);
