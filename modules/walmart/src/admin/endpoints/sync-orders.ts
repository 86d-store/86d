import { createAdminEndpoint } from "@86d-app/core/api";
import type { WalmartController } from "../../service";

export const syncOrdersEndpoint = createAdminEndpoint(
	"/admin/walmart/sync-orders",
	{ method: "POST" },
	async (ctx) => {
		const controller = ctx.context.controllers.walmart as WalmartController;
		const orders = await controller.syncOrders();
		return { synced: orders.length };
	},
);
