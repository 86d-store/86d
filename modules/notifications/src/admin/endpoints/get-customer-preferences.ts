import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { NotificationsController } from "../../service";

export const getCustomerPreferencesEndpoint = createAdminEndpoint(
	"/admin/notifications/preferences/:customerId",
	{
		method: "GET",
		params: z.object({ customerId: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const preferences = await controller.getPreferences(ctx.params.customerId);
		return { preferences };
	},
);
