import {
	calculateRatesUnavailable as calculateRates,
	trackShipmentUnavailable as trackShipment,
} from "./activation-unavailable";
import { listCarriers } from "./list-carriers";
import { listMethods } from "./list-methods";
import { createContainedShippingWebhook } from "./webhook";

export function createStoreEndpointsWithRates(opts?: {
	webhookSecret?: string | undefined;
}) {
	return {
		...storeEndpoints,
		"/shipping/webhook": createContainedShippingWebhook({
			webhookSecret: opts?.webhookSecret,
		}),
	};
}

export const storeEndpoints = {
	"/shipping/calculate": calculateRates,
	"/shipping/methods": listMethods,
	"/shipping/carriers": listCarriers,
	"/shipping/track/:id": trackShipment,
};
