import { getByLocationEndpoint } from "./get-by-location";
import { getMenuEndpoint } from "./get-menu";
import { listMenusEndpoint } from "./list-menus";

export const storeEndpoints = {
	"/navigation": listMenusEndpoint,
	"/navigation/location/:location": getByLocationEndpoint,
	"/navigation/:slug": getMenuEndpoint,
};
