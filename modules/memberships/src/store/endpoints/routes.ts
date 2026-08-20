import { cancel } from "./cancel";
import { checkAccess } from "./check-access";
import { getMembership } from "./get-membership";
import { getPlan } from "./get-plan";
import { listPlans } from "./list-plans";
import { subscribe } from "./subscribe";

export const storeEndpoints = {
	"/memberships/plans": listPlans,
	"/memberships/plans/:slug": getPlan,
	"/memberships/my-membership": getMembership,
	"/memberships/subscribe": subscribe,
	"/memberships/cancel": cancel,
	"/memberships/check-access": checkAccess,
};
