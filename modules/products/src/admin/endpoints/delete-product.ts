import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { Product } from "../../controllers";

export const deleteProduct = createAdminEndpoint(
	"/admin/products/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controllers = ctx.context.controllers;

		// Check if product exists
		const existingProduct = (await controllers.product.getById(
			ctx,
		)) as Product | null;
		if (!existingProduct) {
			return {
				error: "Product not found",
				status: 404,
			};
		}

		await controllers.product.delete(ctx);

		void ctx.context.events?.emit("product.deleted", {
			productId: existingProduct.id,
			name: existingProduct.name,
			slug: existingProduct.slug,
		});

		return { success: true, message: "Product deleted successfully" };
	},
);
