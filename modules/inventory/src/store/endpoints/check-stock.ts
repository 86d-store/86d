import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InventoryController } from "../../service";

export const checkStock = createStoreEndpoint(
	"/inventory/check",
	{
		method: "GET",
		query: z.object({
			productId: z.string().max(200),
			variantId: z.string().max(200).optional(),
			locationId: z.string().max(200).optional(),
			quantity: z.coerce.number().int().min(1).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.inventory as InventoryController;
		const inStock = await controller.isInStock({
			productId: ctx.query.productId,
			variantId: ctx.query.variantId,
			locationId: ctx.query.locationId,
			quantity: ctx.query.quantity,
		});
		const item = await controller.getStock({
			productId: ctx.query.productId,
			variantId: ctx.query.variantId,
			locationId: ctx.query.locationId,
		});
		return {
			inStock,
			available: item?.available ?? null,
			allowBackorder: item?.allowBackorder ?? false,
		};
	},
);
