import { availableWindows } from "./available-windows";
import { cancelPickupStore } from "./cancel-pickup-store";
import { listLocationsStore } from "./list-locations";
import { orderPickup } from "./order-pickup";
import { schedulePickup } from "./schedule-pickup";

export const storeEndpoints = {
	"/store-pickup/locations": listLocationsStore,
	"/store-pickup/locations/:locationId/windows": availableWindows,
	"/store-pickup/schedule": schedulePickup,
	"/store-pickup/order/:orderId": orderPickup,
	"/store-pickup/:id/cancel": cancelPickupStore,
};
