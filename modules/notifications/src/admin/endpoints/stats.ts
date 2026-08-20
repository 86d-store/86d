import { createAdminEndpoint } from "@86d-app/core/api";
import type { NotificationsController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/notifications/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const stats = await controller.getStats();
		return { stats };
	},
);
