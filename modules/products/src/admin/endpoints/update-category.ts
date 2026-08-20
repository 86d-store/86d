import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { Category } from "../../controllers";

export const updateCategory = createAdminEndpoint(
	"/admin/categories/:id/update",
	{
		method: "PUT",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			slug: z.string().min(1).max(200).optional(),
			description: z
				.string()
				.max(2000)
				.transform(sanitizeText)
				.nullable()
				.optional(),
			parentId: z.string().nullable().optional(),
			image: z.string().max(2048).nullable().optional(),
			position: z.number().int().min(0).optional(),
			isVisible: z.boolean().optional(),
			metadata: z
				.record(z.string().max(100), z.unknown())
				.refine((r) => Object.keys(r).length <= 50, "Too many metadata keys")
				.optional(),
		}),
	},
	async (ctx) => {
		const { params, body } = ctx;
		const controllers = ctx.context.controllers;

		// Check if category exists
		const existingCategory = (await controllers.category.getById(
			ctx,
		)) as Category | null;
		if (!existingCategory) {
			return {
				error: "Category not found",
				status: 404,
			};
		}

		// If slug is being changed, check uniqueness
		if (body.slug && body.slug !== existingCategory.slug) {
			const categoryWithSlug = await controllers.category.getBySlug({
				...ctx,
				query: { slug: body.slug },
			});
			if (categoryWithSlug) {
				return {
					error: "A category with this slug already exists",
					status: 400,
				};
			}
		}

		// Prevent circular parent reference
		if (body.parentId === params.id) {
			return {
				error: "A category cannot be its own parent",
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

		const category = await controllers.category.update(ctx);

		return { category };
	},
);
