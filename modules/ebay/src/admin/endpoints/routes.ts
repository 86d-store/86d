import { activeAuctionsEndpoint } from "./active-auctions";
import { createListingEndpoint } from "./create-listing";
import { endListingEndpoint } from "./end-listing";
import { getListingEndpoint } from "./get-listing";
import type { createGetSettingsEndpoint } from "./get-settings";
import { listListingsEndpoint } from "./list-listings";
import { listOrdersEndpoint } from "./list-orders";
import { shipOrderEndpoint } from "./ship-order";
import { statsEndpoint } from "./stats";
import { syncOrdersEndpoint } from "./sync-orders";
import { updateListingEndpoint } from "./update-listing";

export function createAdminEndpointsWithSettings(
	settingsEndpoint: ReturnType<typeof createGetSettingsEndpoint>,
) {
	return {
		...adminEndpoints,
		"/admin/ebay/settings": settingsEndpoint,
	};
}

export const adminEndpoints = {
	"/admin/ebay/listings": listListingsEndpoint,
	"/admin/ebay/listings/create": createListingEndpoint,
	"/admin/ebay/listings/:id": getListingEndpoint,
	"/admin/ebay/listings/:id/update": updateListingEndpoint,
	"/admin/ebay/listings/:id/end": endListingEndpoint,
	"/admin/ebay/orders": listOrdersEndpoint,
	"/admin/ebay/orders/:id/ship": shipOrderEndpoint,
	"/admin/ebay/orders/sync": syncOrdersEndpoint,
	"/admin/ebay/stats": statsEndpoint,
	"/admin/ebay/auctions": activeAuctionsEndpoint,
};
