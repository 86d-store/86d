import { createAdminEndpoint } from "@86d-app/core/api";
import type { InventoryController } from "../../service";

export const backInStockStats = createAdminEndpoint(
	"/admin/inventory/back-in-stock/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.inventory as InventoryController;
		const stats = await controller.getBackInStockStats();
		return { stats };
	},
);
