import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { NotificationsController } from "../../service";

export const getNotificationEndpoint = createStoreEndpoint(
	"/notifications/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) return { error: "Not authenticated", status: 401 };

		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const notification = await controller.get(ctx.params.id);
		if (!notification || notification.customerId !== customerId) {
			return { error: "Notification not found", status: 404 };
		}
		return { notification };
	},
);
