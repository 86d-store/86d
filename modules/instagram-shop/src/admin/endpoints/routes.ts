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
import { tagProductEndpoint } from "./tag-product";
import { untagProductEndpoint } from "./untag-product";
import { updateListingEndpoint } from "./update-listing";
import { updateOrderStatusEndpoint } from "./update-order-status";

export function createAdminEndpointsWithSettings(
	settingsEndpoint: ReturnType<typeof createGetSettingsEndpoint>,
) {
	return {
		...adminEndpoints,
		"/admin/instagram-shop/settings": settingsEndpoint,
	};
}

export const adminEndpoints = {
	"/admin/instagram-shop/listings/create": createListingEndpoint,
	"/admin/instagram-shop/listings": listListingsEndpoint,
	"/admin/instagram-shop/listings/:id": getListingEndpoint,
	"/admin/instagram-shop/listings/:id/update": updateListingEndpoint,
	"/admin/instagram-shop/listings/:id/delete": deleteListingEndpoint,
	"/admin/instagram-shop/listings/:id/push": pushProductEndpoint,
	"/admin/instagram-shop/listings/:id/tag": tagProductEndpoint,
	"/admin/instagram-shop/listings/:id/untag": untagProductEndpoint,
	"/admin/instagram-shop/sync": syncCatalogEndpoint,
	"/admin/instagram-shop/syncs": listSyncsEndpoint,
	"/admin/instagram-shop/products/sync": syncProductsEndpoint,
	"/admin/instagram-shop/orders": listOrdersEndpoint,
	"/admin/instagram-shop/orders/:id": getOrderEndpoint,
	"/admin/instagram-shop/orders/:id/status": updateOrderStatusEndpoint,
	"/admin/instagram-shop/orders/sync": syncOrdersEndpoint,
	"/admin/instagram-shop/stats": statsEndpoint,
};
