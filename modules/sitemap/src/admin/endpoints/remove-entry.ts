import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SitemapController } from "../../service";

export const removeEntry = createAdminEndpoint(
	"/admin/sitemap/entries/:id/remove",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.sitemap as SitemapController;
		const removed = await controller.removeEntry(ctx.params.id);

		if (!removed) {
			return { error: "Entry not found", status: 404 };
		}

		return { success: true };
	},
);
