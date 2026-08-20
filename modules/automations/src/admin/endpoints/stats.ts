import { createAdminEndpoint } from "@86d-app/core/api";
import type { AutomationsController } from "../../service";

export const automationStats = createAdminEndpoint(
	"/admin/automations/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.automations as AutomationsController;
		return controller.getStats();
	},
);
