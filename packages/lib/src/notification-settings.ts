export const NOTIFICATION_EVENT_TYPES = [
	"order.placed",
	"order.shipped",
	"order.delivered",
	"order.cancelled",
	"order.completed",
	"order.refunded",
	"payment.failed",
	"subscription.created",
	"subscription.cancelled",
	"subscription.updated",
	"customer.created",
	"inventory.low",
	"review.created",
	"back_in_stock",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

interface NotificationSettings {
	fromAddress?: string | undefined;
	adminEmail?: string | undefined;
	events?: Record<string, boolean> | undefined;
}

export function parseNotificationSettings(raw: unknown): NotificationSettings {
	if (!raw || typeof raw !== "object") return {};
	const obj = raw as Record<string, unknown>;
	return {
		fromAddress:
			typeof obj.fromAddress === "string" ? obj.fromAddress : undefined,
		adminEmail: typeof obj.adminEmail === "string" ? obj.adminEmail : undefined,
		events:
			obj.events && typeof obj.events === "object"
				? (obj.events as Record<string, boolean>)
				: undefined,
	};
}

export function isEventEnabled(
	settings: NotificationSettings,
	eventType: string,
): boolean {
	if (!settings.events) return true;
	return settings.events[eventType] !== false;
}
