import { triggerEvent } from "./trigger-event";
import { createWebhookEndpoint } from "./webhook";

export function createStoreEndpoints(opts?: {
	webhookSecret?: string | undefined;
}) {
	return {
		"/automations/trigger": triggerEvent,
		"/automations/webhooks": createWebhookEndpoint(opts),
	};
}
