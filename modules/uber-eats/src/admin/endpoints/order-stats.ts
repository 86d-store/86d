import { createAdminEndpoint } from "@86d-app/core/api";
import type { UberEatsController } from "../../service";

export const orderStatsEndpoint = createAdminEndpoint(
	"/admin/uber-eats/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"uber-eats"
		] as UberEatsController;
		const stats = await controller.getOrderStats();
		return { stats };
	},
);
