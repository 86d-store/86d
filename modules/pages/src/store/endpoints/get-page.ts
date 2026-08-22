import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PagesController } from "../../service";

export const getPageEndpoint = createStoreEndpoint(
	"/pages/:slug",
	{
		method: "GET",
		params: z.object({ slug: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.pages as PagesController;
		const page = await controller.getPageBySlug(ctx.params.slug);
		if (page?.status !== "published") {
			return { page: null };
		}
		return { page };
	},
);
