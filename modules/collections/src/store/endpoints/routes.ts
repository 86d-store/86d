import { getCollectionProducts } from "./get-collection-products";
import { getProductCollections } from "./get-product-collections";

/**
 * Products still exposes temporary compatibility reads at `/collections` while
 * legacy collection rows are migrated. All Collection writes and the canonical
 * product-membership reads belong to this Module.
 */
export const storeEndpoints = {
	"/collections/product/:productId": getProductCollections,
	"/collections/:slug/products": getCollectionProducts,
};
