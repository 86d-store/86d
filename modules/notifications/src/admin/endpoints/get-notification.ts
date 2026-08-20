import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { NotificationsController } from "../../service";

export const getNotificationEndpoint = createAdminEndpoint(
	"/admin/notifications/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const notification = await controller.get(ctx.params.id);
		if (!notification) return { error: "Notification not found" };
		return { notification };
	},
);
