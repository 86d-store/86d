import { getNavigationEndpoint } from "./get-navigation";
import { getPageEndpoint } from "./get-page";
import { listPagesEndpoint } from "./list-pages";

export const storeEndpoints = {
	"/pages": listPagesEndpoint,
	"/pages/navigation": getNavigationEndpoint,
	"/pages/:slug": getPageEndpoint,
};
