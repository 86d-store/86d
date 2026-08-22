import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";

export const addCollectionProduct = createAdminEndpoint(
	"/admin/products/collections/:id/products",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			productId: z.string().min(1),
			position: z.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const link = await ctx.context.controllers.collection.addProduct(ctx);
		return { link, status: 201 };
	},
);
