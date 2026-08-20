import { addBundleItem } from "./add-bundle-item";
import { createBundle } from "./create-bundle";
import { deleteBundle } from "./delete-bundle";
import { getBundle } from "./get-bundle";
import { listBundleItems } from "./list-bundle-items";
import { listBundles } from "./list-bundles";
import { removeBundleItem } from "./remove-bundle-item";
import { updateBundle } from "./update-bundle";
import { updateBundleItem } from "./update-bundle-item";

export const adminEndpoints = {
	"/admin/bundles": listBundles,
	"/admin/bundles/create": createBundle,
	"/admin/bundles/:id": getBundle,
	"/admin/bundles/:id/update": updateBundle,
	"/admin/bundles/:id/delete": deleteBundle,
	"/admin/bundles/:id/items": listBundleItems,
	"/admin/bundles/:id/items/add": addBundleItem,
	"/admin/bundles/:id/items/:itemId/remove": removeBundleItem,
	"/admin/bundles/:id/items/:itemId/update": updateBundleItem,
};
