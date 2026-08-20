import { createAdminEndpoint } from "@86d-app/core/api";
import type { AmazonController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/amazon/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.amazon as AmazonController;
		const stats = await controller.getChannelStats();
		return { stats };
	},
);
