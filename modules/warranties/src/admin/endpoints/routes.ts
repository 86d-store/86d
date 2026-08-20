import { approveClaim } from "./approve-claim";
import { claimSummary } from "./claim-summary";
import { closeClaim } from "./close-claim";
import { createPlan } from "./create-plan";
import { deletePlan } from "./delete-plan";
import { denyClaim } from "./deny-claim";
import { getClaim } from "./get-claim";
import { getRegistration } from "./get-registration";
import { listClaims } from "./list-claims";
import { listPlans } from "./list-plans";
import { listRegistrations } from "./list-registrations";
import { registerWarranty } from "./register-warranty";
import { resolveClaim } from "./resolve-claim";
import { reviewClaim } from "./review-claim";
import { startRepair } from "./start-repair";
import { updatePlan } from "./update-plan";
import { voidRegistration } from "./void-registration";

export const adminEndpoints = {
	"/admin/warranties/plans": listPlans,
	"/admin/warranties/plans/create": createPlan,
	"/admin/warranties/plans/:id": updatePlan,
	"/admin/warranties/plans/:id/delete": deletePlan,
	"/admin/warranties/registrations": listRegistrations,
	"/admin/warranties/registrations/create": registerWarranty,
	"/admin/warranties/registrations/:id": getRegistration,
	"/admin/warranties/registrations/:id/void": voidRegistration,
	"/admin/warranties/claims": listClaims,
	"/admin/warranties/claims/summary": claimSummary,
	"/admin/warranties/claims/:id": getClaim,
	"/admin/warranties/claims/:id/review": reviewClaim,
	"/admin/warranties/claims/:id/approve": approveClaim,
	"/admin/warranties/claims/:id/deny": denyClaim,
	"/admin/warranties/claims/:id/repair": startRepair,
	"/admin/warranties/claims/:id/resolve": resolveClaim,
	"/admin/warranties/claims/:id/close": closeClaim,
};
