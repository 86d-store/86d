import { createRule } from "./create-rule";
import { createTier } from "./create-tier";
import { deleteRule } from "./delete-rule";
import { deleteTier } from "./delete-tier";
import { getRule } from "./get-rule";
import { getTier } from "./get-tier";
import { listRules } from "./list-rules";
import { listTiers } from "./list-tiers";
import { previewTiers } from "./preview-tiers";
import { summary } from "./summary";
import { updateRule } from "./update-rule";
import { updateTier } from "./update-tier";

export const adminEndpoints = {
	// Rules
	"/admin/bulk-pricing/rules": listRules,
	"/admin/bulk-pricing/rules/create": createRule,
	"/admin/bulk-pricing/rules/:id": getRule,
	"/admin/bulk-pricing/rules/:id/update": updateRule,
	"/admin/bulk-pricing/rules/:id/delete": deleteRule,
	"/admin/bulk-pricing/rules/:id/preview": previewTiers,
	// Tiers
	"/admin/bulk-pricing/tiers": listTiers,
	"/admin/bulk-pricing/tiers/create": createTier,
	"/admin/bulk-pricing/tiers/:id": getTier,
	"/admin/bulk-pricing/tiers/:id/update": updateTier,
	"/admin/bulk-pricing/tiers/:id/delete": deleteTier,
	// Analytics
	"/admin/bulk-pricing/summary": summary,
};
