import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";

export const adminListProducts = createAdminEndpoint(
	"/admin/products/list",
	{
		method: "GET",
		query: z
			.object({
				page: z.string().optional(),
				limit: z.string().optional(),
				category: z.string().optional(),
				status: z.enum(["draft", "active", "archived"]).optional(),
				featured: z.string().optional(),
				search: z.string().optional(),
				sort: z.enum(["name", "price", "createdAt", "updatedAt"]).optional(),
				order: z.enum(["asc", "desc"]).optional(),
			})
			.optional(),
	},
	async (ctx) => {
		// Call the controller directly - it handles query parsing internally
		const result = await ctx.context.controllers.product.list(ctx);
		return result;
	},
);
