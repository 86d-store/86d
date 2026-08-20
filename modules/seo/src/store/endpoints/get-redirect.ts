import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SeoController } from "../../service";

export const getRedirectEndpoint = createStoreEndpoint(
	"/seo/redirect",
	{
		method: "GET",
		query: z.object({
			path: z.string().min(1).max(2000),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.seo as SeoController;
		const redirect = await controller.getRedirectByPath(ctx.query.path);
		return { redirect };
	},
);
