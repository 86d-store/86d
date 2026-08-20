import { archiveRegistry } from "./archive-registry";
import { deleteRegistry } from "./delete-registry";
import { getRegistry } from "./get-registry";
import { listItems } from "./list-items";
import { listPurchases } from "./list-purchases";
import { listRegistries } from "./list-registries";
import { registrySummary } from "./registry-summary";

export const adminEndpoints = {
	"/admin/gift-registry": listRegistries,
	"/admin/gift-registry/summary": registrySummary,
	"/admin/gift-registry/:id": getRegistry,
	"/admin/gift-registry/:id/delete": deleteRegistry,
	"/admin/gift-registry/:id/archive": archiveRegistry,
	"/admin/gift-registry/:id/items": listItems,
	"/admin/gift-registry/:id/purchases": listPurchases,
};
