import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AnnouncementsController } from "../../service";

export const deleteAnnouncement = createAdminEndpoint(
	"/admin/announcements/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.announcements as AnnouncementsController;

		await controller.deleteAnnouncement(ctx.params.id);

		return { success: true };
	},
);
