import { cancelDropEndpoint } from "./cancel-drop";
import { createDropEndpoint } from "./create-drop";
import { createListingEndpoint } from "./create-listing";
import { deleteListingEndpoint } from "./delete-listing";
import { dropStatsEndpoint } from "./drop-stats";
import { getDropEndpoint } from "./get-drop";
import { getListingEndpoint } from "./get-listing";
import { getOrderEndpoint } from "./get-order";
import type { createGetSettingsEndpoint } from "./get-settings";
import { listDropsEndpoint } from "./list-drops";
import { listListingsEndpoint } from "./list-listings";
import { listOrdersEndpoint } from "./list-orders";
import { statsEndpoint } from "./stats";
import { updateListingEndpoint } from "./update-listing";
import { updateOrderStatusEndpoint } from "./update-order-status";

export function createAdminEndpointsWithSettings(
	settingsEndpoint: ReturnType<typeof createGetSettingsEndpoint>,
) {
	return {
		...adminEndpoints,
		"/admin/x-shop/settings": settingsEndpoint,
	};
}

export const adminEndpoints = {
	"/admin/x-shop/listings/create": createListingEndpoint,
	"/admin/x-shop/listings": listListingsEndpoint,
	"/admin/x-shop/listings/:id": getListingEndpoint,
	"/admin/x-shop/listings/:id/update": updateListingEndpoint,
	"/admin/x-shop/listings/:id/delete": deleteListingEndpoint,
	"/admin/x-shop/orders": listOrdersEndpoint,
	"/admin/x-shop/orders/:id": getOrderEndpoint,
	"/admin/x-shop/orders/:id/status": updateOrderStatusEndpoint,
	"/admin/x-shop/drops/create": createDropEndpoint,
	"/admin/x-shop/drops": listDropsEndpoint,
	"/admin/x-shop/drops/:id": getDropEndpoint,
	"/admin/x-shop/drops/:id/cancel": cancelDropEndpoint,
	"/admin/x-shop/drops/:id/stats": dropStatsEndpoint,
	"/admin/x-shop/stats": statsEndpoint,
};
