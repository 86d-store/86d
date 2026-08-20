import { customerItems } from "./customer-items";
import { deleteItem } from "./delete-item";
import { frequentProducts } from "./frequent-products";
import { listAllItems } from "./list-items";

export const adminEndpoints = {
	"/admin/comparisons": listAllItems,
	"/admin/comparisons/frequent": frequentProducts,
	"/admin/comparisons/customer/:id": customerItems,
	"/admin/comparisons/:id/delete": deleteItem,
};
