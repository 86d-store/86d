import { createListingEndpoint } from "./create-listing";
import { deleteListingEndpoint } from "./delete-listing";
import { getListingEndpoint } from "./get-listing";
import { getOrderEndpoint } from "./get-order";
import type { createGetSettingsEndpoint } from "./get-settings";
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
		"/admin/tiktok-shop/settings": settingsEndpoint,
	};
}

export const adminEndpoints = {
	"/admin/tiktok-shop/listings/create": createListingEndpoint,
	"/admin/tiktok-shop/listings": listListingsEndpoint,
	"/admin/tiktok-shop/listings/:id": getListingEndpoint,
	"/admin/tiktok-shop/listings/:id/update": updateListingEndpoint,
	"/admin/tiktok-shop/listings/:id/delete": deleteListingEndpoint,
	"/admin/tiktok-shop/listings/:id/push": pushProductEndpoint,
	"/admin/tiktok-shop/sync": syncCatalogEndpoint,
	"/admin/tiktok-shop/syncs": listSyncsEndpoint,
	"/admin/tiktok-shop/products/sync": syncProductsEndpoint,
	"/admin/tiktok-shop/orders": listOrdersEndpoint,
	"/admin/tiktok-shop/orders/:id": getOrderEndpoint,
	"/admin/tiktok-shop/orders/:id/status": updateOrderStatusEndpoint,
	"/admin/tiktok-shop/orders/sync": syncOrdersEndpoint,
	"/admin/tiktok-shop/stats": statsEndpoint,
};
