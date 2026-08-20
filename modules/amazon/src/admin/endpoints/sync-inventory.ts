import { createAdminEndpoint } from "@86d-app/core/api";
import type { AmazonController } from "../../service";

export const syncInventoryEndpoint = createAdminEndpoint(
	"/admin/amazon/inventory/sync",
	{
		method: "POST",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.amazon as AmazonController;
		const sync = await controller.syncInventory();
		return { sync };
	},
);
