import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";

export const createCollection = createAdminEndpoint(
	"/admin/products/collections/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			slug: z.string().min(1).max(200),
			description: z.string().max(5000).transform(sanitizeText).optional(),
			image: z.string().max(2000).optional(),
			isFeatured: z.boolean().optional(),
			isVisible: z.boolean().optional(),
			position: z.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const { body } = ctx;

		// Check slug uniqueness
		const existing = await ctx.context.controllers.collection.getBySlug({
			...ctx,
			query: { slug: body.slug },
		});
		if (existing) {
			return {
				error: "A collection with this slug already exists",
				status: 400,
			};
		}

		const collection = await ctx.context.controllers.collection.create(ctx);
		return { collection, status: 201 };
	},
);
