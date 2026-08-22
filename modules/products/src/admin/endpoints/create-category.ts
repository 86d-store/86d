import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";

export const createCategory = createAdminEndpoint(
	"/admin/categories/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			slug: z.string().min(1).max(200),
			description: z.string().max(2000).transform(sanitizeText).optional(),
			parentId: z.string().optional(),
			image: z.string().optional(),
			position: z.number().int().min(0).optional(),
			isVisible: z.boolean().optional(),
			metadata: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 50, "Too many metadata keys")
				.optional(),
		}),
	},
	async (ctx) => {
		const { body } = ctx;
		const controllers = ctx.context.controllers;

		// Check if slug is unique
		const existingCategory = await controllers.category.getBySlug({
			...ctx,
			query: { slug: body.slug },
		});
		if (existingCategory) {
			return {
				error: "A category with this slug already exists",
				status: 400,
			};
		}

		// If parentId is provided, check if parent exists
		if (body.parentId) {
			const parentCategory = await controllers.category.getById({
				...ctx,
				params: { id: body.parentId },
			});
			if (!parentCategory) {
				return {
					error: "Parent category not found",
					status: 400,
				};
			}
		}

		const category = await controllers.category.create(ctx);

		return { category, status: 201 };
	},
);
