import { syncMenuEndpoint } from "./sync-menu";
import { syncOrderEndpoint } from "./sync-order";
import type { createToastWebhook } from "./webhook";

export const storeEndpoints = {
	"/toast/sync/menu": syncMenuEndpoint,
	"/toast/sync/order": syncOrderEndpoint,
};

export function createStoreEndpointsWithWebhook(
	webhookEndpoint: ReturnType<typeof createToastWebhook>,
) {
	return {
		...storeEndpoints,
		"/toast/webhook": webhookEndpoint,
	};
}
