import { checkAvailabilityEndpoint } from "./check-availability";
import { createDeliveryEndpoint } from "./create-delivery";
import { getDeliveryEndpoint } from "./get-delivery";

// No-credentials mode: omit quote endpoints that require the DoorDash API provider.
// Delivery creation still works locally (without tracking/driver info).
export const storeEndpoints = {
	"/doordash/deliveries": createDeliveryEndpoint,
	"/doordash/deliveries/:id": getDeliveryEndpoint,
	"/doordash/availability": checkAvailabilityEndpoint,
};

/**
 * @deprecated DoorDash provider activation is unavailable until authenticated
 * lifecycle ingestion is implemented. This factory intentionally exposes only
 * standalone, local routes.
 */
export function createStoreEndpoints() {
	return storeEndpoints;
}
