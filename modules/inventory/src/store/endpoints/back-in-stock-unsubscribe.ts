import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InventoryController } from "../../service";

export const backInStockUnsubscribe = createStoreEndpoint(
	"/inventory/back-in-stock/unsubscribe",
	{
		method: "POST",
		body: z.object({
			productId: z.string().max(200),
			variantId: z.string().max(200).optional(),
			email: z.string().email().max(320),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.inventory as InventoryController;
		const removed = await controller.unsubscribeBackInStock({
			productId: ctx.body.productId,
			variantId: ctx.body.variantId,
			email: ctx.body.email,
		});
		return { removed };
	},
);
