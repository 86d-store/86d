import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { InventoryController } from "../../service";

export const backInStockList = createAdminEndpoint(
	"/admin/inventory/back-in-stock",
	{
		method: "GET",
		query: z.object({
			productId: z.string().optional(),
			status: z.string().optional(),
			take: z.coerce.number().int().min(1).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.inventory as InventoryController;
		const subscriptions = await controller.listBackInStockSubscriptions({
			productId: ctx.query.productId,
			status: ctx.query.status,
			take: ctx.query.take,
			skip: ctx.query.skip,
		});
		return { subscriptions };
	},
);
