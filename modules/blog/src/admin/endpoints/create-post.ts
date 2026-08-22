import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { BlogController } from "../../service";

export const createPostEndpoint = createAdminEndpoint(
	"/admin/blog/create",
	{
		method: "POST",
		body: z.object({
			title: z.string().min(1).max(500).transform(sanitizeText),
			slug: z.string().max(500).transform(sanitizeText).optional(),
			content: z.string().min(1),
			excerpt: z.string().max(1000).transform(sanitizeText).optional(),
			coverImage: z.string().url().optional(),
			author: z.string().max(200).transform(sanitizeText).optional(),
			status: z.enum(["draft", "published", "scheduled"]).optional(),
			tags: z.array(z.string().max(100)).max(20).optional(),
			category: z.string().max(200).transform(sanitizeText).optional(),
			featured: z.boolean().optional(),
			metaTitle: z.string().max(200).transform(sanitizeText).optional(),
			metaDescription: z.string().max(500).transform(sanitizeText).optional(),
			scheduledAt: z.coerce.date().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.blog as BlogController;
		const post = await controller.createPost({
			title: ctx.body.title,
			slug: ctx.body.slug ?? "",
			content: ctx.body.content,
			excerpt: ctx.body.excerpt,
			coverImage: ctx.body.coverImage,
			author: ctx.body.author,
			status: ctx.body.status,
			tags: ctx.body.tags,
			category: ctx.body.category,
			featured: ctx.body.featured,
			metaTitle: ctx.body.metaTitle,
			metaDescription: ctx.body.metaDescription,
			scheduledAt: ctx.body.scheduledAt,
		});
		return { post };
	},
);
