import { adminCancelSubscription } from "./cancel-subscription";
import { createPlan } from "./create-plan";
import { deletePlan } from "./delete-plan";
import { getSubscription } from "./get-subscription";
import { listPlans } from "./list-plans";
import { listSubscriptions } from "./list-subscriptions";
import { adminRenewSubscription } from "./renew-subscription";
import { updatePlan } from "./update-plan";

export const adminEndpoints = {
	"/admin/subscriptions": listSubscriptions,
	"/admin/subscriptions/:id": getSubscription,
	"/admin/subscriptions/:id/cancel": adminCancelSubscription,
	"/admin/subscriptions/:id/renew": adminRenewSubscription,
	"/admin/subscriptions/plans": listPlans,
	"/admin/subscriptions/plans/create": createPlan,
	"/admin/subscriptions/plans/:id/update": updatePlan,
	"/admin/subscriptions/plans/:id/delete": deletePlan,
};
