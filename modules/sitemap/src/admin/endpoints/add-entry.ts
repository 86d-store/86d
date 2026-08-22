import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
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

export const addEntry = createAdminEndpoint(
	"/admin/sitemap/entries/add",
	{
		method: "POST",
		body: z.object({
			path: z.string().min(1).max(2000),
			changefreq: z.enum(changeFreqValues).optional(),
			priority: z.number().min(0).max(1).optional(),
			lastmod: z.coerce.date().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.sitemap as SitemapController;

		const params: Parameters<typeof controller.addEntry>[0] = {
			path: ctx.body.path,
		};
		if (ctx.body.changefreq != null) params.changefreq = ctx.body.changefreq;
		if (ctx.body.priority != null) params.priority = ctx.body.priority;
		if (ctx.body.lastmod != null) params.lastmod = ctx.body.lastmod;

		const entry = await controller.addEntry(params);

		return { entry };
	},
);
