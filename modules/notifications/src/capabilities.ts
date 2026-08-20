import { provideCapability } from "@86d-app/core/capabilities";
import { notificationCreateCapability } from "@86d-app/core/commerce-capabilities";
import { createNotificationsController } from "./service-impl";

export { notificationCreateCapability };

export const notificationCreateProvider = provideCapability(
	notificationCreateCapability,
	async (ctx, request) => {
		try {
			const max = ctx.options.maxPerCustomer;
			const notification = await createNotificationsController(
				ctx.data,
				ctx.events,
				{
					...(typeof max === "number" ? { maxPerCustomer: max } : {}),
				},
			).create({
				customerId: request.customerId,
				type: "info",
				channel: "in_app",
				priority: "normal",
				title: request.title,
				body: request.body,
				metadata: request.metadata,
			});
			return {
				ok: true,
				decision: { notificationId: notification.id },
			};
		} catch {
			return { ok: false, failure: { code: "create_failed" as const } };
		}
	},
);
