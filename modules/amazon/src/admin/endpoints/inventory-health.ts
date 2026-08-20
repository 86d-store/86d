import { createAdminEndpoint } from "@86d-app/core/api";
import type { AmazonController } from "../../service";

export const inventoryHealthEndpoint = createAdminEndpoint(
	"/admin/amazon/inventory/health",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.amazon as AmazonController;
		const health = await controller.getInventoryHealth();
		return { health };
	},
);
