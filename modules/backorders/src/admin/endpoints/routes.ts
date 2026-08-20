import { allocateStock } from "./allocate-stock";
import { backorderSummary } from "./backorder-summary";
import { bulkUpdateStatus } from "./bulk-update-status";
import { cancelBackorderAdmin } from "./cancel-backorder";
import { deletePolicy } from "./delete-policy";
import { getBackorderAdmin } from "./get-backorder";
import { getPolicy } from "./get-policy";
import { listBackorders } from "./list-backorders";
import { listPolicies } from "./list-policies";
import { setPolicy } from "./set-policy";
import { updateStatus } from "./update-status";

export const adminEndpoints = {
	"/admin/backorders": listBackorders,
	"/admin/backorders/summary": backorderSummary,
	"/admin/backorders/bulk-status": bulkUpdateStatus,
	"/admin/backorders/allocate": allocateStock,
	"/admin/backorders/policies": listPolicies,
	"/admin/backorders/policies/set": setPolicy,
	"/admin/backorders/policies/:productId": getPolicy,
	"/admin/backorders/policies/:productId/delete": deletePolicy,
	"/admin/backorders/:id": getBackorderAdmin,
	"/admin/backorders/:id/status": updateStatus,
	"/admin/backorders/:id/cancel": cancelBackorderAdmin,
};
