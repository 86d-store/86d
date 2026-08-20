import { createAdminEndpoint } from "@86d-app/core/api";
import type { AnnouncementsController } from "../../service";

export const stats = createAdminEndpoint(
	"/admin/announcements/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.announcements as AnnouncementsController;

		const stats = await controller.getStats();

		return { stats };
	},
);
