import { createAdminEndpoint } from "@86d-app/core/api";
import type { WalmartController } from "../../service";

export const itemHealthEndpoint = createAdminEndpoint(
	"/admin/walmart/items/health",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.walmart as WalmartController;
		const health = await controller.getItemHealth();
		return { health };
	},
);
