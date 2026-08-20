import { createFacebookShopWebhook } from "./webhook";

export { createFacebookShopWebhook };

export function createStoreEndpoints(appSecret?: string | undefined) {
	const webhookEndpoint = createFacebookShopWebhook(appSecret);
	return {
		"/facebook-shop/webhooks": webhookEndpoint,
	};
}

/** Default store endpoints without signature verification. */
export const storeEndpoints = createStoreEndpoints();
