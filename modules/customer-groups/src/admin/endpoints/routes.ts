import { addMember } from "./add-member";
import { addRule } from "./add-rule";
import { bulkAddMembers } from "./bulk-add-members";
import { bulkRemoveMembers } from "./bulk-remove-members";
import { createGroup } from "./create-group";
import { deleteGroup } from "./delete-group";
import { evaluateRules } from "./evaluate-rules";
import { getGroup } from "./get-group";
import { listGroups } from "./list-groups";
import { listMembers } from "./list-members";
import { listPricing } from "./list-pricing";
import { removeMember } from "./remove-member";
import { removePricing } from "./remove-pricing";
import { removeRule } from "./remove-rule";
import { setPricing } from "./set-pricing";
import { getStats } from "./stats";
import { updateGroup } from "./update-group";

export const adminEndpoints = {
	"/admin/customer-groups": listGroups,
	"/admin/customer-groups/create": createGroup,
	"/admin/customer-groups/stats": getStats,
	"/admin/customer-groups/evaluate": evaluateRules,
	"/admin/customer-groups/rules/:ruleId/remove": removeRule,
	"/admin/customer-groups/pricing/:adjustmentId/remove": removePricing,
	"/admin/customer-groups/:id": getGroup,
	"/admin/customer-groups/:id/update": updateGroup,
	"/admin/customer-groups/:id/delete": deleteGroup,
	"/admin/customer-groups/:id/members": listMembers,
	"/admin/customer-groups/:id/members/add": addMember,
	"/admin/customer-groups/:id/members/remove": removeMember,
	"/admin/customer-groups/:id/members/bulk-add": bulkAddMembers,
	"/admin/customer-groups/:id/members/bulk-remove": bulkRemoveMembers,
	"/admin/customer-groups/:id/pricing": setPricing,
	"/admin/customer-groups/:id/pricing/list": listPricing,
	"/admin/customer-groups/:id/rules/add": addRule,
};
