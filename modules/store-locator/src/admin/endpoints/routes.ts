import { createLocation } from "./create-location";
import { deleteLocation } from "./delete-location";
import { getLocation } from "./get-location";
import { listLocations } from "./list-locations";
import { getStats } from "./stats";
import { updateLocation } from "./update-location";

export const adminEndpoints = {
	"/admin/store-locator/locations": listLocations,
	"/admin/store-locator/locations/create": createLocation,
	"/admin/store-locator/locations/:id": getLocation,
	"/admin/store-locator/locations/:id/update": updateLocation,
	"/admin/store-locator/locations/:id/delete": deleteLocation,
	"/admin/store-locator/stats": getStats,
};
