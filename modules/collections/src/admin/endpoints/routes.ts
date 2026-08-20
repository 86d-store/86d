import { addProducts } from "./add-products";
import { createCollection } from "./create-collection";
import { deleteCollection } from "./delete-collection";
import { getCollectionProducts } from "./get-collection-products";
import { getStats } from "./get-stats";
import { listCollections } from "./list-collections";
import { removeProducts } from "./remove-products";
import { reorderProducts } from "./reorder-products";
import { updateCollection } from "./update-collection";

export const adminEndpoints = {
	"/admin/collections": listCollections,
	"/admin/collections/stats": getStats,
	"/admin/collections/create": createCollection,
	"/admin/collections/:id/update": updateCollection,
	"/admin/collections/:id/delete": deleteCollection,
	"/admin/collections/:id/products": getCollectionProducts,
	"/admin/collections/:id/products/add": addProducts,
	"/admin/collections/:id/products/remove": removeProducts,
	"/admin/collections/:id/products/reorder": reorderProducts,
};
