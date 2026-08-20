import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { NotificationsController } from "../../service";

export const deleteNotificationEndpoint = createAdminEndpoint(
	"/admin/notifications/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const deleted = await controller.delete(ctx.params.id);
		return { success: deleted };
	},
);
