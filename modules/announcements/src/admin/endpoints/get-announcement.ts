import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AnnouncementsController } from "../../service";

export const getAnnouncement = createAdminEndpoint(
	"/admin/announcements/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.announcements as AnnouncementsController;

		const announcement = await controller.getAnnouncement(ctx.params.id);

		if (!announcement) {
			return { error: "Announcement not found", status: 404 };
		}

		return { announcement };
	},
);
