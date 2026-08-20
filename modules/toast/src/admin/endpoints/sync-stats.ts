import { createAdminEndpoint } from "@86d-app/core/api";
import type { ToastController } from "../../service";

export const syncStatsEndpoint = createAdminEndpoint(
	"/admin/toast/sync-stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.toast as ToastController;
		const stats = await controller.getSyncStats();
		return { stats };
	},
);
