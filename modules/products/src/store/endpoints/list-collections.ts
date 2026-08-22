import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";

export const listCollections = createStoreEndpoint(
	"/collections",
	{
		method: "GET",
		query: z
			.object({
				page: z.string().max(10).optional(),
				limit: z.string().max(10).optional(),
				featured: z.string().max(10).optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const result = await ctx.context.controllers.collection.list({
			...ctx,
			query: { ...ctx.query, visible: "true" },
		});
		return result;
	},
);
