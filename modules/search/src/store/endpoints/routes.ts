import { clickEndpoint } from "./click";
import { recentEndpoint } from "./recent";
import { searchEndpoint } from "./search";
import { storeSearch } from "./store-search";
import { suggestEndpoint } from "./suggest";

export const storeEndpoints = {
	"/search/store-search": storeSearch,
	"/search": searchEndpoint,
	"/search/suggest": suggestEndpoint,
	"/search/recent": recentEndpoint,
	"/search/click": clickEndpoint,
};
