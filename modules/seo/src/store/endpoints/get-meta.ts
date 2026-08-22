import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SeoController } from "../../service";

export const getMetaEndpoint = createStoreEndpoint(
	"/seo/meta",
	{
		method: "GET",
		query: z.object({
			path: z.string().min(1).max(2000),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.seo as SeoController;
		const meta = await controller.getMetaTagByPath(ctx.query.path);
		return { meta };
	},
);
