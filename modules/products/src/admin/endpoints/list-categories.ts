import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";

export const adminListCategories = createAdminEndpoint(
	"/admin/categories/list",
	{
		method: "GET",
		query: z
			.object({
				page: z.string().optional(),
				limit: z.string().optional(),
				parent: z.string().optional(),
				visible: z.string().optional(),
			})
			.optional(),
	},
	async (ctx) => {
		// Call the controller directly - it handles query parsing internally
		const result = await ctx.context.controllers.category.list(ctx);
		return result;
	},
);
