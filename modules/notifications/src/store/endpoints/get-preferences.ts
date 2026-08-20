import { createStoreEndpoint } from "@86d-app/core/api";
import type { NotificationsController } from "../../service";

export const getPreferencesEndpoint = createStoreEndpoint(
	"/notifications/preferences",
	{
		method: "GET",
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) return { error: "Not authenticated", status: 401 };

		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const preferences = await controller.getPreferences(customerId);
		return { preferences };
	},
);
