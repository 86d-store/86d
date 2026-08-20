export function notificationDeliveryDurabilityRequired() {
	return {
		code: "NOTIFICATION_DELIVERY_DURABILITY_REQUIRED",
		error:
			"External notification delivery requires a durable intent and provider acceptance receipt.",
		status: 503,
	};
}
