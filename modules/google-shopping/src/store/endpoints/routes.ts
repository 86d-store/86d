import { createGoogleShoppingWebhook } from "./webhooks";

export { createGoogleShoppingWebhook };

export function createStoreEndpoints(webhookSecret?: string | undefined) {
	const webhookEndpoint = createGoogleShoppingWebhook(webhookSecret);
	return {
		"/google-shopping/webhooks": webhookEndpoint,
	};
}

/** Default store endpoints without signature verification. */
export const storeEndpoints = createStoreEndpoints();
