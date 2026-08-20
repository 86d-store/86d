import { bulkExpire } from "./bulk-expire";
import { deleteAbandoned } from "./delete-abandoned";
import { dismissCart } from "./dismiss-cart";
import { getAbandoned } from "./get-abandoned";
import { getStats } from "./get-stats";
import { listAbandoned } from "./list-abandoned";
import { sendRecovery } from "./send-recovery";

export const adminEndpoints = {
	"/admin/abandoned-carts": listAbandoned,
	"/admin/abandoned-carts/stats": getStats,
	"/admin/abandoned-carts/bulk-expire": bulkExpire,
	"/admin/abandoned-carts/:id": getAbandoned,
	"/admin/abandoned-carts/:id/recover": sendRecovery,
	"/admin/abandoned-carts/:id/dismiss": dismissCart,
	"/admin/abandoned-carts/:id/delete": deleteAbandoned,
};
