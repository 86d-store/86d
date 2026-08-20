import { createAdminEndpoint } from "@86d-app/core/api";
import type { WalmartController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/walmart/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.walmart as WalmartController;
		const stats = await controller.getChannelStats();
		return { stats };
	},
);
