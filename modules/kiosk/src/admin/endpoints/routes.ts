import { createStationEndpoint } from "./create-station";
import { kioskStatsEndpoint } from "./kiosk-stats";
import { listSessionsEndpoint } from "./list-sessions";
import { listStationOptionsEndpoint } from "./list-station-options";
import { listStationsEndpoint } from "./list-stations";
import { updateStationEndpoint } from "./update-station";

export const adminEndpoints = {
	"/admin/kiosk/stations": listStationsEndpoint,
	"/admin/kiosk/station-options": listStationOptionsEndpoint,
	"/admin/kiosk/stations/create": createStationEndpoint,
	"/admin/kiosk/stations/:id": updateStationEndpoint,
	"/admin/kiosk/sessions": listSessionsEndpoint,
	"/admin/kiosk/stats": kioskStatsEndpoint,
};
