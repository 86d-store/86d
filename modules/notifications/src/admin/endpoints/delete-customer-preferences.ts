import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { NotificationsController } from "../../service";

export const deleteCustomerPreferencesEndpoint = createAdminEndpoint(
	"/admin/notifications/preferences/:customerId/delete",
	{
		method: "POST",
		params: z.object({ customerId: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const deleted = await controller.deletePreferences(ctx.params.customerId);
		if (!deleted) {
			return { error: "Preferences not found", status: 404 };
		}
		return { deleted: true };
	},
);
