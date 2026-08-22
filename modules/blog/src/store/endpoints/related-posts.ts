import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BlogController } from "../../service";

export const relatedPostsEndpoint = createStoreEndpoint(
	"/blog/:slug/related",
	{
		method: "GET",
		params: z.object({ slug: z.string().min(1).max(200) }),
		query: z.object({
			limit: z.coerce.number().int().min(1).max(10).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.blog as BlogController;
		const post = await controller.getPostBySlug(ctx.params.slug);
		if (post?.status !== "published") {
			return { posts: [] };
		}
		const posts = await controller.getRelatedPosts(
			post.id,
			ctx.query.limit ?? 5,
		);
		return { posts };
	},
);
