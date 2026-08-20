import { assignProducts } from "./assign-products";
import { createBrand } from "./create-brand";
import { deleteBrand } from "./delete-brand";
import { getBrand } from "./get-brand";
import { getBrandProducts } from "./get-brand-products";
import { getStats } from "./get-stats";
import { listBrands } from "./list-brands";
import { unassignProducts } from "./unassign-products";
import { updateBrand } from "./update-brand";

export const adminEndpoints = {
	"/admin/brands": listBrands,
	"/admin/brands/stats": getStats,
	"/admin/brands/create": createBrand,
	"/admin/brands/:id": getBrand,
	"/admin/brands/:id/update": updateBrand,
	"/admin/brands/:id/delete": deleteBrand,
	"/admin/brands/:id/products": getBrandProducts,
	"/admin/brands/:id/products/assign": assignProducts,
	"/admin/brands/:id/products/unassign": unassignProducts,
};
