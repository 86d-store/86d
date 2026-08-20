import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SitemapController } from "../../service";

export const getEntry = createAdminEndpoint(
	"/admin/sitemap/entries/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.sitemap as SitemapController;
		const entry = await controller.getEntry(ctx.params.id);

		if (!entry) {
			return { error: "Entry not found", status: 404 };
		}

		return { entry };
	},
);
