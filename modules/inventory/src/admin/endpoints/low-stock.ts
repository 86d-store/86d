import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { InventoryController } from "../../service";

export const lowStock = createAdminEndpoint(
	"/admin/inventory/low-stock",
	{
		method: "GET",
		query: z.object({
			locationId: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.inventory as InventoryController;
		const items = await controller.getLowStockItems({
			locationId: ctx.query.locationId,
		});
		return { items };
	},
);
