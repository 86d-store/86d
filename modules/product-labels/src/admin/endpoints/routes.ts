import { assignLabel } from "./assign-label";
import { bulkAssign } from "./bulk-assign";
import { bulkUnassign } from "./bulk-unassign";
import { createLabel } from "./create-label";
import { deleteLabel } from "./delete-label";
import { labelStats } from "./label-stats";
import { adminListLabels } from "./list-labels";
import { adminProductLabels } from "./product-labels";
import { unassignLabel } from "./unassign-label";
import { updateLabel } from "./update-label";

export const adminEndpoints = {
	"/admin/product-labels": adminListLabels,
	"/admin/product-labels/create": createLabel,
	"/admin/product-labels/assign": assignLabel,
	"/admin/product-labels/unassign": unassignLabel,
	"/admin/product-labels/bulk-assign": bulkAssign,
	"/admin/product-labels/bulk-unassign": bulkUnassign,
	"/admin/product-labels/stats": labelStats,
	"/admin/product-labels/products/:productId": adminProductLabels,
	"/admin/product-labels/:id/update": updateLabel,
	"/admin/product-labels/:id/delete": deleteLabel,
};
