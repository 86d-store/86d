import { activitySummary } from "./activity-summary";
import { cleanupEvents } from "./cleanup-events";
import { createBadge } from "./create-badge";
import { deleteBadge } from "./delete-badge";
import { adminListBadges } from "./list-badges";
import { adminListEvents } from "./list-events";
import { updateBadge } from "./update-badge";

export const adminEndpoints = {
	"/admin/social-proof/events": adminListEvents,
	"/admin/social-proof/events/cleanup": cleanupEvents,
	"/admin/social-proof/summary": activitySummary,
	"/admin/social-proof/badges": adminListBadges,
	"/admin/social-proof/badges/create": createBadge,
	"/admin/social-proof/badges/:id/update": updateBadge,
	"/admin/social-proof/badges/:id/delete": deleteBadge,
};
