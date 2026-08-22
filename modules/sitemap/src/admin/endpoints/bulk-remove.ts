import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SitemapController } from "../../service";

export const bulkRemoveEntries = createAdminEndpoint(
	"/admin/sitemap/entries/bulk-remove",
	{
		method: "POST",
		body: z.object({
			ids: z.array(z.string().min(1)).min(1).max(500),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.sitemap as SitemapController;
		const removed = await controller.bulkRemoveEntries(ctx.body.ids);

		return { removed };
	},
);
