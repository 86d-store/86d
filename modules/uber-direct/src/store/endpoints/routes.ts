import { checkAvailability } from "./check-availability";
import { createDelivery } from "./create-delivery";
import { getDelivery } from "./get-delivery";
import { requestQuote } from "./request-quote";
import type { createUberDirectWebhook } from "./webhook";

export function createStoreEndpoints(
	webhookEndpoint: ReturnType<typeof createUberDirectWebhook>,
) {
	return {
		"/uber-direct/availability": checkAvailability,
		"/uber-direct/quotes": requestQuote,
		"/uber-direct/deliveries": createDelivery,
		"/uber-direct/deliveries/:id": getDelivery,
		"/uber-direct/webhook": webhookEndpoint,
	};
}

// No-credentials mode: availability check and delivery read still work locally.
export const storeEndpoints = {
	"/uber-direct/availability": checkAvailability,
	"/uber-direct/deliveries/:id": getDelivery,
};
