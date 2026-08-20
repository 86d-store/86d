import { createAdminEndpoint } from "@86d-app/core/api";
import type { EbayController } from "../../service";

export const syncOrdersEndpoint = createAdminEndpoint(
	"/admin/ebay/orders/sync",
	{ method: "POST" },
	async (ctx) => {
		const controller = ctx.context.controllers.ebay as EbayController;
		const orders = await controller.syncOrders();
		return { synced: orders.length };
	},
);
