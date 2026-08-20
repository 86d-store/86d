import { createStationEndpoint } from "./create-station";
import { deleteStationEndpoint } from "./delete-station";
import { kioskStatsEndpoint } from "./kiosk-stats";
import { listSessionsEndpoint } from "./list-sessions";
import { listStationsEndpoint } from "./list-stations";
import { updateStationEndpoint } from "./update-station";

export const adminEndpoints = {
	"/admin/kiosk/stations": listStationsEndpoint,
	"/admin/kiosk/stations/create": createStationEndpoint,
	"/admin/kiosk/stations/:id": updateStationEndpoint,
	"/admin/kiosk/stations/:id/delete": deleteStationEndpoint,
	"/admin/kiosk/sessions": listSessionsEndpoint,
	"/admin/kiosk/stats": kioskStatsEndpoint,
};
