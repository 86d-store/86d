import { createCatalogItemEndpoint } from "./create-catalog-item";
import { createPinEndpoint } from "./create-pin";
import { deleteCatalogItemEndpoint } from "./delete-catalog-item";
import { getCatalogItemEndpoint } from "./get-catalog-item";
import type { createGetSettingsEndpoint } from "./get-settings";
import { listCatalogItemsEndpoint } from "./list-catalog-items";
import { listPinsEndpoint } from "./list-pins";
import { listSyncsEndpoint } from "./list-syncs";
import { statsEndpoint } from "./stats";
import { syncCatalogEndpoint } from "./sync-catalog";
import { updateCatalogItemEndpoint } from "./update-catalog-item";

export function createAdminEndpointsWithSettings(
	settingsEndpoint: ReturnType<typeof createGetSettingsEndpoint>,
) {
	return {
		...adminEndpoints,
		"/admin/pinterest-shop/settings": settingsEndpoint,
	};
}

export const adminEndpoints = {
	"/admin/pinterest-shop/items": listCatalogItemsEndpoint,
	"/admin/pinterest-shop/items/create": createCatalogItemEndpoint,
	"/admin/pinterest-shop/items/:id": getCatalogItemEndpoint,
	"/admin/pinterest-shop/items/:id/update": updateCatalogItemEndpoint,
	"/admin/pinterest-shop/items/:id/delete": deleteCatalogItemEndpoint,
	"/admin/pinterest-shop/sync": syncCatalogEndpoint,
	"/admin/pinterest-shop/syncs": listSyncsEndpoint,
	"/admin/pinterest-shop/pins": listPinsEndpoint,
	"/admin/pinterest-shop/pins/create": createPinEndpoint,
	"/admin/pinterest-shop/stats": statsEndpoint,
};
