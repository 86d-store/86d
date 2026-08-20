import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";

export const searchProducts = createStoreEndpoint(
	"/products/search",
	{
		method: "GET",
		query: z.object({
			q: z.string().min(1).max(500).transform(sanitizeText),
			limit: z.string().max(10).optional(),
		}),
	},
	async (ctx) => {
		const products = await ctx.context.controllers.product.search(ctx);
		return { products };
	},
);
