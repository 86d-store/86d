import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";

export const getRelatedProducts = createStoreEndpoint(
	"/products/:id/related",
	{
		method: "GET",
		params: z.object({
			id: z.string().max(200),
		}),
		query: z
			.object({
				limit: z.string().max(10).optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const result = await ctx.context.controllers.product.getRelated(ctx);
		return result;
	},
);
