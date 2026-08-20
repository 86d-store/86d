import { addBenefit } from "./add-benefit";
import { cancelMembership } from "./cancel-membership";
import { createPlan } from "./create-plan";
import { deletePlan } from "./delete-plan";
import { gateProduct } from "./gate-product";
import { getMembership } from "./get-membership";
import { getStats } from "./get-stats";
import { listMemberships } from "./list-memberships";
import { listPlans } from "./list-plans";
import { pauseMembership } from "./pause-membership";
import { removeBenefit } from "./remove-benefit";
import { resumeMembership } from "./resume-membership";
import { ungateProduct } from "./ungate-product";
import { updatePlan } from "./update-plan";

export const adminEndpoints = {
	"/admin/memberships": listMemberships,
	"/admin/memberships/stats": getStats,
	"/admin/memberships/plans": listPlans,
	"/admin/memberships/plans/create": createPlan,
	"/admin/memberships/plans/:id/update": updatePlan,
	"/admin/memberships/plans/:id/delete": deletePlan,
	"/admin/memberships/plans/:planId/benefits/add": addBenefit,
	"/admin/memberships/plans/:planId/products/gate": gateProduct,
	"/admin/memberships/plans/:planId/products/ungate": ungateProduct,
	"/admin/memberships/benefits/:id/remove": removeBenefit,
	"/admin/memberships/:id": getMembership,
	"/admin/memberships/:id/cancel": cancelMembership,
	"/admin/memberships/:id/pause": pauseMembership,
	"/admin/memberships/:id/resume": resumeMembership,
};
