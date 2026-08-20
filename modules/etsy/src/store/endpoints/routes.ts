import { createEtsyWebhook } from "./webhooks";

export { createEtsyWebhook };

export function createStoreEndpoints(webhookSecret?: string | undefined) {
	return {
		"/etsy/webhooks": createEtsyWebhook(webhookSecret),
	};
}

export const storeEndpoints = createStoreEndpoints();
