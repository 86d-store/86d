import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";

export const removeCollectionProduct = createAdminEndpoint(
	"/admin/products/collections/:id/products/:productId/remove",
	{
		method: "DELETE",
		params: z.object({
			id: z.string(),
			productId: z.string(),
		}),
	},
	async (ctx) => {
		return ctx.context.controllers.collection.removeProduct(ctx);
	},
);
