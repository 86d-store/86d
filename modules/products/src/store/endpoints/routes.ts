import { getCategory } from "./get-category";
import { getCollection } from "./get-collection";
import { getFeaturedProducts } from "./get-featured";
import { getProduct } from "./get-product";
import { getRelatedProducts } from "./get-related";
import { listCategories } from "./list-categories";
import { listCollections } from "./list-collections";
import { listProducts } from "./list-products";
import { searchProducts } from "./search-products";
import { storeSearch } from "./store-search";

export const storeEndpoints = {
	"/products": listProducts,
	"/products/featured": getFeaturedProducts,
	"/products/search": searchProducts,
	"/products/store-search": storeSearch,
	"/products/:id": getProduct,
	"/products/:id/related": getRelatedProducts,
	"/categories": listCategories,
	"/categories/:id": getCategory,
	"/collections": listCollections,
	"/collections/:id": getCollection,
};
