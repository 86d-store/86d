import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";

export const adminListCollections = createAdminEndpoint(
	"/admin/products/collections/list",
	{
		method: "GET",
		query: z
			.object({
				page: z.string().optional(),
				limit: z.string().optional(),
				featured: z.string().optional(),
				visible: z.string().optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const result = await ctx.context.controllers.collection.list(ctx);
		return result;
	},
);
