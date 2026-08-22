import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";

export const getFeaturedProducts = createStoreEndpoint(
	"/products/featured",
	{
		method: "GET",
		query: z
			.object({
				limit: z.string().max(10).optional(),
			})
			.optional(),
	},
	async (ctx) => {
		// Call the controller directly
		const products = await ctx.context.controllers.product.getFeatured(ctx);
		return { products };
	},
);
