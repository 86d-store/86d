import { adjustStock } from "./adjust-stock";
import { backInStockDelete } from "./back-in-stock-delete";
import { backInStockList } from "./back-in-stock-list";
import { backInStockStats } from "./back-in-stock-stats";
import { listItems } from "./list-items";
import { lowStock } from "./low-stock";
import { setStock } from "./set-stock";

export const adminEndpoints = {
	"/admin/inventory": listItems,
	"/admin/inventory/set": setStock,
	"/admin/inventory/adjust": adjustStock,
	"/admin/inventory/low-stock": lowStock,
	"/admin/inventory/back-in-stock": backInStockList,
	"/admin/inventory/back-in-stock/stats": backInStockStats,
	"/admin/inventory/back-in-stock/:id": backInStockDelete,
};
