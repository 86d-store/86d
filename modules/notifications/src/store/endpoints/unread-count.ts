import { createStoreEndpoint } from "@86d-app/core/api";
import type { NotificationsController } from "../../service";

export const unreadCountEndpoint = createStoreEndpoint(
	"/notifications/unread-count",
	{
		method: "GET",
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) return { error: "Not authenticated", status: 401 };

		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const count = await controller.unreadCount(customerId);
		return { count };
	},
);
