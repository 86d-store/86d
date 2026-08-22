import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { NotificationsController } from "../../service";

export const bulkDeleteEndpoint = createAdminEndpoint(
	"/admin/notifications/bulk-delete",
	{
		method: "POST",
		body: z.object({
			ids: z.array(z.string()).min(1).max(100),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const deleted = await controller.bulkDelete(ctx.body.ids);
		return { deleted };
	},
);
