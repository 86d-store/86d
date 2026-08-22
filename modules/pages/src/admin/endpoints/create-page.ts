import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeHtml, sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { PagesController } from "../../service";

export const createPageEndpoint = createAdminEndpoint(
	"/admin/pages/create",
	{
		method: "POST",
		body: z.object({
			title: z.string().min(1).max(500).transform(sanitizeText),
			slug: z.string().max(500).transform(sanitizeText).optional(),
			content: z.string().min(1).transform(sanitizeHtml),
			excerpt: z.string().max(1000).transform(sanitizeText).optional(),
			status: z.enum(["draft", "published"]).optional(),
			template: z.string().max(200).optional(),
			metaTitle: z.string().max(200).transform(sanitizeText).optional(),
			metaDescription: z.string().max(500).transform(sanitizeText).optional(),
			featuredImage: z.string().url().optional(),
			position: z.number().int().min(0).optional(),
			showInNavigation: z.boolean().optional(),
			parentId: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.pages as PagesController;
		const page = await controller.createPage({
			title: ctx.body.title,
			slug: ctx.body.slug,
			content: ctx.body.content,
			excerpt: ctx.body.excerpt,
			status: ctx.body.status,
			template: ctx.body.template,
			metaTitle: ctx.body.metaTitle,
			metaDescription: ctx.body.metaDescription,
			featuredImage: ctx.body.featuredImage,
			position: ctx.body.position,
			showInNavigation: ctx.body.showInNavigation,
			parentId: ctx.body.parentId,
		});
		return { page };
	},
);
