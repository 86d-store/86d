import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";

export const listProducts = createStoreEndpoint(
	"/products",
	{
		method: "GET",
		query: z
			.object({
				page: z.string().max(10).optional(),
				limit: z.string().max(10).optional(),
				category: z.string().max(200).transform(sanitizeText).optional(),
				featured: z.string().max(10).optional(),
				search: z.string().max(500).transform(sanitizeText).optional(),
				sort: z.enum(["name", "price", "createdAt", "updatedAt"]).optional(),
				order: z.enum(["asc", "desc"]).optional(),
				minPrice: z.string().max(20).optional(),
				maxPrice: z.string().max(20).optional(),
				inStock: z.string().max(10).optional(),
				tag: z.string().max(200).transform(sanitizeText).optional(),
			})
			.optional(),
	},
	async (ctx) => {
		// Call the controller directly - it handles query parsing internally
		const result = await ctx.context.controllers.product.list(ctx);
		return result;
	},
);
