import { addProduct } from "./add-product";
import { bulkAddProducts } from "./bulk-add-products";
import { createFlashSale } from "./create-flash-sale";
import { deleteFlashSale } from "./delete-flash-sale";
import { getFlashSale } from "./get-flash-sale";
import { getStats } from "./get-stats";
import { listFlashSales } from "./list-flash-sales";
import { listProducts } from "./list-products";
import { removeProduct } from "./remove-product";
import { updateFlashSale } from "./update-flash-sale";

export const adminEndpoints = {
	"/admin/flash-sales": listFlashSales,
	"/admin/flash-sales/stats": getStats,
	"/admin/flash-sales/create": createFlashSale,
	"/admin/flash-sales/:id": getFlashSale,
	"/admin/flash-sales/:id/update": updateFlashSale,
	"/admin/flash-sales/:id/delete": deleteFlashSale,
	"/admin/flash-sales/:id/products": listProducts,
	"/admin/flash-sales/:id/products/add": addProduct,
	"/admin/flash-sales/:id/products/:productId/remove": removeProduct,
	"/admin/flash-sales/:id/products/bulk": bulkAddProducts,
};
