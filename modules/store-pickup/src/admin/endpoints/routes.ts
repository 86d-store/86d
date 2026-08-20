import { cancelPickup } from "./cancel-pickup";
import { createBlackout } from "./create-blackout";
import { createLocation } from "./create-location";
import { createWindow } from "./create-window";
import { deleteBlackout } from "./delete-blackout";
import { deleteLocation } from "./delete-location";
import { deleteWindow } from "./delete-window";
import { getLocation } from "./get-location";
import { getPickup } from "./get-pickup";
import { listBlackoutsAdmin } from "./list-blackouts";
import { listLocations } from "./list-locations";
import { listPickups } from "./list-pickups";
import { listWindows } from "./list-windows";
import { summary } from "./summary";
import { updateLocation } from "./update-location";
import { updatePickupStatus } from "./update-pickup-status";
import { updateWindow } from "./update-window";

export const adminEndpoints = {
	"/admin/store-pickup/locations": listLocations,
	"/admin/store-pickup/locations/create": createLocation,
	"/admin/store-pickup/locations/:id": getLocation,
	"/admin/store-pickup/locations/:id/update": updateLocation,
	"/admin/store-pickup/locations/:id/delete": deleteLocation,
	"/admin/store-pickup/windows": listWindows,
	"/admin/store-pickup/windows/create": createWindow,
	"/admin/store-pickup/windows/:id/update": updateWindow,
	"/admin/store-pickup/windows/:id/delete": deleteWindow,
	"/admin/store-pickup/pickups": listPickups,
	"/admin/store-pickup/pickups/:id": getPickup,
	"/admin/store-pickup/pickups/:id/status": updatePickupStatus,
	"/admin/store-pickup/pickups/:id/cancel": cancelPickup,
	"/admin/store-pickup/blackouts": listBlackoutsAdmin,
	"/admin/store-pickup/blackouts/create": createBlackout,
	"/admin/store-pickup/blackouts/:id/delete": deleteBlackout,
	"/admin/store-pickup/summary": summary,
};
