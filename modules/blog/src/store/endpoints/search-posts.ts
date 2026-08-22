import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { BlogController } from "../../service";

export const searchPostsEndpoint = createStoreEndpoint(
	"/blog/search",
	{
		method: "GET",
		query: z.object({
			q: z.string().min(1).max(200).transform(sanitizeText),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(50).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.blog as BlogController;
		const limit = ctx.query.limit ?? 20;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const posts = await controller.listPosts({
			status: "published",
			search: ctx.query.q,
			take: limit,
			skip,
		});
		return { posts, total: posts.length };
	},
);
