import { apply } from "./apply";
import { getVendor } from "./get-vendor";
import { listVendors } from "./list-vendors";
import { vendorProducts } from "./vendor-products";

export const storeEndpoints = {
	"/vendors": listVendors,
	"/vendors/:slug": getVendor,
	"/vendors/:vendorId/products": vendorProducts,
	"/vendors/apply": apply,
};
