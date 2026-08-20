import { createAdminEndpoint } from "@86d-app/core/api";
import type { WishController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/wish/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.wish as WishController;
		const stats = await controller.getChannelStats();
		return { stats };
	},
);
