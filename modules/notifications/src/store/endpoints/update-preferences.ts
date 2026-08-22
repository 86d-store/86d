import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { NotificationsController } from "../../service";

export const updatePreferencesEndpoint = createStoreEndpoint(
	"/notifications/preferences/update",
	{
		method: "POST",
		body: z.object({
			orderUpdates: z.boolean().optional(),
			promotions: z.boolean().optional(),
			shippingAlerts: z.boolean().optional(),
			accountAlerts: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) return { error: "Not authenticated", status: 401 };

		const controller = ctx.context.controllers
			.notifications as NotificationsController;
		const preferences = await controller.updatePreferences(customerId, {
			orderUpdates: ctx.body.orderUpdates,
			promotions: ctx.body.promotions,
			shippingAlerts: ctx.body.shippingAlerts,
			accountAlerts: ctx.body.accountAlerts,
		});
		return { preferences };
	},
);
