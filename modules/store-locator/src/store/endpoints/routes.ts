import { checkHours } from "./check-hours";
import { getLocation } from "./get-location";
import { getRegions } from "./get-regions";
import { listLocations } from "./list-locations";
import { searchNearby } from "./search-nearby";

export const storeEndpoints = {
	"/locations": listLocations,
	"/locations/nearby": searchNearby,
	"/locations/regions": getRegions,
	"/locations/:slug": getLocation,
	"/locations/:id/hours": checkHours,
};
