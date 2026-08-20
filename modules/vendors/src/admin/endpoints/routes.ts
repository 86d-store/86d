import { assignProduct } from "./assign-product";
import { createPayout } from "./create-payout";
import { createVendor } from "./create-vendor";
import { deleteVendor } from "./delete-vendor";
import { getStats } from "./get-stats";
import { getVendor } from "./get-vendor";
import { listPayouts } from "./list-payouts";
import { listProducts } from "./list-products";
import { listVendors } from "./list-vendors";
import { payoutStats } from "./payout-stats";
import { unassignProduct } from "./unassign-product";
import { updatePayoutStatus } from "./update-payout-status";
import { updateStatus } from "./update-status";
import { updateVendor } from "./update-vendor";

export const adminEndpoints = {
	"/admin/vendors": listVendors,
	"/admin/vendors/stats": getStats,
	"/admin/vendors/create": createVendor,
	"/admin/vendors/payouts/stats": payoutStats,
	"/admin/vendors/payouts/:id/status": updatePayoutStatus,
	"/admin/vendors/:id": getVendor,
	"/admin/vendors/:id/update": updateVendor,
	"/admin/vendors/:id/delete": deleteVendor,
	"/admin/vendors/:id/status": updateStatus,
	"/admin/vendors/:vendorId/products": listProducts,
	"/admin/vendors/:vendorId/products/assign": assignProduct,
	"/admin/vendors/:vendorId/products/:productId/unassign": unassignProduct,
	"/admin/vendors/:vendorId/payouts": listPayouts,
	"/admin/vendors/:vendorId/payouts/create": createPayout,
};
