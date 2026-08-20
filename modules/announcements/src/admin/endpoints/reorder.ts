import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AnnouncementsController } from "../../service";

export const reorder = createAdminEndpoint(
	"/admin/announcements/reorder",
	{
		method: "POST",
		body: z.object({
			ids: z.array(z.string().min(1)).min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.announcements as AnnouncementsController;

		await controller.reorderAnnouncements(ctx.body.ids);

		return { success: true };
	},
);
