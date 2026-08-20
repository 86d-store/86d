import { createAdminEndpoint } from "@86d-app/core/api";
import type { KioskController } from "../../service";

export const kioskStatsEndpoint = createAdminEndpoint(
	"/admin/kiosk/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.kiosk as KioskController;
		const stats = await controller.getOverallStats();
		return { stats };
	},
);
