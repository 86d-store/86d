import { createAdminEndpoint } from "@86d-app/core/api";
import type { EtsyController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/etsy/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.etsy as EtsyController;
		const stats = await controller.getChannelStats();
		return { stats };
	},
);
