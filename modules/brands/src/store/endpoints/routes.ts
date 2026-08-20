import { getBrand } from "./get-brand";
import { getBrandProducts } from "./get-brand-products";
import { getFeatured } from "./get-featured";
import { getProductBrand } from "./get-product-brand";
import { listBrands } from "./list-brands";

export const storeEndpoints = {
	"/brands": listBrands,
	"/brands/featured": getFeatured,
	"/brands/product/:productId": getProductBrand,
	"/brands/:slug": getBrand,
	"/brands/:slug/products": getBrandProducts,
};
