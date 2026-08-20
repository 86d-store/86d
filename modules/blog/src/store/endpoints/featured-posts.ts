import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BlogController } from "../../service";

export const featuredPostsEndpoint = createStoreEndpoint(
	"/blog/featured",
	{
		method: "GET",
		query: z.object({
			limit: z.coerce.number().int().min(1).max(20).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.blog as BlogController;
		const posts = await controller.listPosts({
			status: "published",
			featured: true,
			take: ctx.query.limit ?? 5,
		});
		return { posts };
	},
);
