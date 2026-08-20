import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { NotificationsController } from "../../service";

export const updateCustomerPreferencesEndpoint = createAdminEndpoint(
	"/admin/notifications/preferences/:customerId/update",
	{
		method: "POST",
		params: z.object({ customerId: z.string() }),
		body: z.object({
			orderUpdates: z.boolean().optional(),
			promotions: z.boolean().optional(),
			shippingAlerts: z.boolean().optional(),
			accountAlerts: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const preferences = await controller.updatePreferences(
			ctx.params.customerId,
			ctx.body,
		);
		return { preferences };
	},
);
