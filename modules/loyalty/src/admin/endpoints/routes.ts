import { adjustPoints } from "./adjust-points";
import { createRule } from "./create-rule";
import { deleteRule } from "./delete-rule";
import { getAccount } from "./get-account";
import { listAccounts } from "./list-accounts";
import { listRules } from "./list-rules";
import { listTiers } from "./list-tiers";
import { loyaltySummary } from "./loyalty-summary";
import { createTier, deleteTier, updateTier } from "./manage-tiers";
import { reactivateAccount } from "./reactivate-account";
import { suspendAccount } from "./suspend-account";
import { updateRule } from "./update-rule";

export const adminEndpoints = {
	"/admin/loyalty/accounts": listAccounts,
	"/admin/loyalty/accounts/:customerId": getAccount,
	"/admin/loyalty/accounts/:customerId/adjust": adjustPoints,
	"/admin/loyalty/accounts/:customerId/suspend": suspendAccount,
	"/admin/loyalty/accounts/:customerId/reactivate": reactivateAccount,
	"/admin/loyalty/summary": loyaltySummary,
	"/admin/loyalty/rules": listRules,
	"/admin/loyalty/rules/create": createRule,
	"/admin/loyalty/rules/:id/update": updateRule,
	"/admin/loyalty/rules/:id/delete": deleteRule,
	"/admin/loyalty/tiers": listTiers,
	"/admin/loyalty/tiers/create": createTier,
	"/admin/loyalty/tiers/:id/update": updateTier,
	"/admin/loyalty/tiers/:id/delete": deleteTier,
};
