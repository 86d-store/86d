import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SitemapController } from "../../service";

export const listEntries = createAdminEndpoint(
	"/admin/sitemap/entries",
	{
		method: "GET",
		query: z.object({
			source: z.string().max(50).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.sitemap as SitemapController;

		const params: Parameters<typeof controller.listEntries>[0] = {
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		};
		if (ctx.query.source != null) params.source = ctx.query.source;

		const entries = await controller.listEntries(params);
		const total = await controller.countEntries(ctx.query.source);

		return { entries, total };
	},
);
