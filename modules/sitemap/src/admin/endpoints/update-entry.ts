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

export const updateEntry = createAdminEndpoint(
	"/admin/sitemap/entries/:id/update",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			path: z.string().min(1).max(2000).optional(),
			changefreq: z.enum(changeFreqValues).optional(),
			priority: z.number().min(0).max(1).optional(),
			lastmod: z.coerce.date().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.sitemap as SitemapController;

		const params: Parameters<typeof controller.updateEntry>[1] = {};
		if (ctx.body.path != null) params.path = ctx.body.path;
		if (ctx.body.changefreq != null) params.changefreq = ctx.body.changefreq;
		if (ctx.body.priority != null) params.priority = ctx.body.priority;
		if (ctx.body.lastmod != null) params.lastmod = ctx.body.lastmod;

		const entry = await controller.updateEntry(ctx.params.id, params);

		if (!entry) {
			return { error: "Entry not found", status: 404 };
		}

		return { entry };
	},
);
