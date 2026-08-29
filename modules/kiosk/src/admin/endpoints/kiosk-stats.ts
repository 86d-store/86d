import { createAdminEndpoint } from "@86d-app/core/api";
import type { KioskController } from "../../service";
import { KioskMutationUnavailableError } from "../../service-impl";

export const kioskStatsEndpoint = createAdminEndpoint(
	"/admin/kiosk/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.kiosk as KioskController;
		try {
			const stats = await controller.getOverallStats();
			return {
				stats: {
					...stats,
					onlineStations: 0,
					completedSessions: 0,
					totalRevenue: 0,
				},
			};
		} catch (error) {
			if (error instanceof KioskMutationUnavailableError) {
				return { error: "Kiosk statistics are unavailable", status: 503 };
			}
			throw error;
		}
	},
);
