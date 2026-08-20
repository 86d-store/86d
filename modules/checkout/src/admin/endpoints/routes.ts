import { adminExpireStale } from "./expire-stale";
import { adminGetSession } from "./get-session";
import { adminGetStats } from "./get-stats";
import { adminListSessions } from "./list-sessions";

export const adminEndpoints = {
	"/admin/checkout/sessions": adminListSessions,
	"/admin/checkout/sessions/:id": adminGetSession,
	"/admin/checkout/stats": adminGetStats,
	"/admin/checkout/expire-stale": adminExpireStale,
};
