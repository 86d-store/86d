import { createInstagramShopWebhook } from "./webhook";

export { createInstagramShopWebhook };

export function createStoreEndpoints(appSecret?: string | undefined) {
	const webhookEndpoint = createInstagramShopWebhook(appSecret);
	return {
		"/instagram-shop/webhooks": webhookEndpoint,
	};
}

/** Default store endpoints without signature verification. */
export const storeEndpoints = createStoreEndpoints();
