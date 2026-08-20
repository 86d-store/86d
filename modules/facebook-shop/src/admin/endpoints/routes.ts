import { createCollectionEndpoint } from "./create-collection";
import { createListingEndpoint } from "./create-listing";
import { deleteCollectionEndpoint } from "./delete-collection";
import { deleteListingEndpoint } from "./delete-listing";
import { getListingEndpoint } from "./get-listing";
import { getOrderEndpoint } from "./get-order";
import type { createGetSettingsEndpoint } from "./get-settings";
import { listCollectionsEndpoint } from "./list-collections";
import { listListingsEndpoint } from "./list-listings";
import { listOrdersEndpoint } from "./list-orders";
import { listSyncsEndpoint } from "./list-syncs";
import { pushProductEndpoint } from "./push-product";
import { statsEndpoint } from "./stats";
import { syncCatalogEndpoint } from "./sync-catalog";
import { syncOrdersEndpoint } from "./sync-orders";
import { syncProductsEndpoint } from "./sync-products";
import { updateListingEndpoint } from "./update-listing";
import { updateOrderStatusEndpoint } from "./update-order-status";

export function createAdminEndpointsWithSettings(
	settingsEndpoint: ReturnType<typeof createGetSettingsEndpoint>,
) {
	return {
		...adminEndpoints,
		"/admin/facebook-shop/settings": settingsEndpoint,
	};
}

export const adminEndpoints = {
	"/admin/facebook-shop/listings/create": createListingEndpoint,
	"/admin/facebook-shop/listings": listListingsEndpoint,
	"/admin/facebook-shop/listings/:id": getListingEndpoint,
	"/admin/facebook-shop/listings/:id/update": updateListingEndpoint,
	"/admin/facebook-shop/listings/:id/delete": deleteListingEndpoint,
	"/admin/facebook-shop/listings/:id/push": pushProductEndpoint,
	"/admin/facebook-shop/sync": syncCatalogEndpoint,
	"/admin/facebook-shop/syncs": listSyncsEndpoint,
	"/admin/facebook-shop/products/sync": syncProductsEndpoint,
	"/admin/facebook-shop/orders": listOrdersEndpoint,
	"/admin/facebook-shop/orders/:id": getOrderEndpoint,
	"/admin/facebook-shop/orders/:id/status": updateOrderStatusEndpoint,
	"/admin/facebook-shop/orders/sync": syncOrdersEndpoint,
	"/admin/facebook-shop/collections/create": createCollectionEndpoint,
	"/admin/facebook-shop/collections": listCollectionsEndpoint,
	"/admin/facebook-shop/collections/:id/delete": deleteCollectionEndpoint,
	"/admin/facebook-shop/stats": statsEndpoint,
};
