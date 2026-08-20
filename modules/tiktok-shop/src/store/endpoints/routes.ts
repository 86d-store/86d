import { createTikTokShopWebhook } from "./webhook";

export { createTikTokShopWebhook };

export function createStoreEndpoints(appSecret?: string | undefined) {
	const webhookEndpoint = createTikTokShopWebhook(appSecret);
	return {
		"/tiktok-shop/webhooks": webhookEndpoint,
	};
}

/** Default store endpoints without signature verification. */
export const storeEndpoints = createStoreEndpoints();
