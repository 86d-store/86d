import { createAdminEndpoint } from "@86d-app/core/api";
import type { UberDirectController } from "../../service";

export const getDeliveryStats = createAdminEndpoint(
	"/admin/uber-direct/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.uberDirect as UberDirectController;
		const stats = await controller.getDeliveryStats();
		return { stats };
	},
);
