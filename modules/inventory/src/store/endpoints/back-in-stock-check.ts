import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InventoryController } from "../../service";

export const backInStockCheck = createStoreEndpoint(
	"/inventory/back-in-stock/check",
	{
		method: "GET",
		query: z.object({
			productId: z.string().max(200),
			variantId: z.string().max(200).optional(),
			email: z.string().email().max(320),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.inventory as InventoryController;
		const subscribed = await controller.checkBackInStockSubscription({
			productId: ctx.query.productId,
			variantId: ctx.query.variantId,
			email: ctx.query.email,
		});
		return { subscribed };
	},
);
