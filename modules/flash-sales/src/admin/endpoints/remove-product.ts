import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FlashSaleController } from "../../service";

export const removeProduct = createAdminEndpoint(
	"/admin/flash-sales/:id/products/:productId/remove",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
			productId: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.flashSales as FlashSaleController;

		const removed = await controller.removeProduct(
			ctx.params.id,
			ctx.params.productId,
		);
		if (!removed) {
			return { error: "Product not found in this flash sale", status: 404 };
		}

		return { removed: true };
	},
);
