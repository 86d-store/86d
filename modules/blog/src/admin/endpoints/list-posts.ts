import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BlogController, PostStatus } from "../../service";

export const adminListPostsEndpoint = createAdminEndpoint(
	"/admin/blog",
	{
		method: "GET",
		query: z.object({
			status: z
				.enum(["draft", "published", "scheduled", "archived"])
				.optional(),
			category: z.string().optional(),
			tag: z.string().optional(),
			featured: z
				.enum(["true", "false"])
				.transform((v) => v === "true")
				.optional(),
			search: z.string().max(200).optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.blog as BlogController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listPosts({
			status: ctx.query.status as PostStatus | undefined,
			category: ctx.query.category,
			tag: ctx.query.tag,
			featured: ctx.query.featured,
			search: ctx.query.search,
		});
		const total = all.length;
		const posts = all.slice(skip, skip + limit);
		return { posts, total };
	},
);
