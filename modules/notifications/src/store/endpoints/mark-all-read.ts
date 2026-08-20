import { createStoreEndpoint } from "@86d-app/core/api";
import type { NotificationsController } from "../../service";

export const markAllReadEndpoint = createStoreEndpoint(
	"/notifications/read-all",
	{
		method: "POST",
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) return { error: "Not authenticated", status: 401 };

		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const count = await controller.markAllRead(customerId);
		return { marked: count };
	},
);
