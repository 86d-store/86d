import { createAdminEndpoint } from "@86d-app/core/api";
import type { GoogleShoppingController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/google-shopping/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"google-shopping"
		] as GoogleShoppingController;
		const stats = await controller.getChannelStats();
		return { stats };
	},
);
