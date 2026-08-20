import { acceptOrderEndpoint } from "./accept-order";
import { cancelOrderEndpoint } from "./cancel-order";
import { getOrderEndpoint } from "./get-order";
import { markReadyEndpoint } from "./mark-ready";
import { receiveOrderEndpoint } from "./receive-order";
import type { createUberEatsWebhook } from "./webhook";

export const storeEndpoints = {
	"/uber-eats/orders": receiveOrderEndpoint,
	"/uber-eats/orders/:id": getOrderEndpoint,
	"/uber-eats/orders/:id/accept": acceptOrderEndpoint,
	"/uber-eats/orders/:id/ready": markReadyEndpoint,
	"/uber-eats/orders/:id/cancel": cancelOrderEndpoint,
};

export function createStoreEndpointsWithWebhook(
	webhookEndpoint: ReturnType<typeof createUberEatsWebhook>,
) {
	return {
		...storeEndpoints,
		"/uber-eats/webhook": webhookEndpoint,
	};
}
