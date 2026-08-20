import { addItemEndpoint } from "./add-item";
import { completeSessionEndpoint } from "./complete-session";
import { getSessionEndpoint } from "./get-session";
import { heartbeatEndpoint } from "./heartbeat";
import { removeItemEndpoint } from "./remove-item";
import { startSessionEndpoint } from "./start-session";
import { updateItemEndpoint } from "./update-item";

export const storeEndpoints = {
	"/kiosk/sessions": startSessionEndpoint,
	"/kiosk/sessions/:id": getSessionEndpoint,
	"/kiosk/sessions/:id/items": addItemEndpoint,
	"/kiosk/sessions/:id/items/:itemId/delete": removeItemEndpoint,
	"/kiosk/sessions/:id/items/:itemId": updateItemEndpoint,
	"/kiosk/sessions/:id/complete": completeSessionEndpoint,
	"/kiosk/stations/:id/heartbeat": heartbeatEndpoint,
};
