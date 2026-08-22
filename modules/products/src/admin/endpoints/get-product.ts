import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";

export const adminGetProduct = createAdminEndpoint(
	"/admin/products/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const product = await ctx.context.controllers.product.getWithVariants(ctx);

		if (!product) {
			return {
				error: "Product not found",
				status: 404,
			};
		}

		return { product };
	},
);
