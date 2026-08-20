import { createAdminEndpoint } from "@86d-app/core/api";
import type { FavorController } from "../../service";

export const getFavorStats = createAdminEndpoint(
	"/admin/favor/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.favor as FavorController;
		const stats = await controller.getDeliveryStats();
		return { stats };
	},
);
