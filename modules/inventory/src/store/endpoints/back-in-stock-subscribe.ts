import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { InventoryController } from "../../service";

export const backInStockSubscribe = createStoreEndpoint(
	"/inventory/back-in-stock/subscribe",
	{
		method: "POST",
		body: z.object({
			productId: z.string().max(200),
			variantId: z.string().max(200).optional(),
			email: z.string().email().max(320),
			productName: z.string().max(500).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.inventory as InventoryController;
		const customerId = ctx.context.session?.user.id;
		const subscription = await controller.subscribeBackInStock({
			productId: ctx.body.productId,
			variantId: ctx.body.variantId,
			email: ctx.body.email,
			customerId,
			productName: ctx.body.productName,
		});
		return { subscription };
	},
);
