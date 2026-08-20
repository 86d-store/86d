import { addItem } from "./add-item";
import { browseRegistries } from "./browse-registries";
import { createRegistry } from "./create-registry";
import { getRegistry } from "./get-registry";
import { myRegistries } from "./my-registries";
import { purchaseItem } from "./purchase-item";
import { removeItem } from "./remove-item";
import { updateRegistry } from "./update-registry";

export const storeEndpoints = {
	"/gift-registry": browseRegistries,
	"/gift-registry/create": createRegistry,
	"/gift-registry/update": updateRegistry,
	"/gift-registry/items/add": addItem,
	"/gift-registry/items/remove": removeItem,
	"/gift-registry/purchase": purchaseItem,
	"/gift-registry/mine": myRegistries,
	"/gift-registry/:slug": getRegistry,
};
