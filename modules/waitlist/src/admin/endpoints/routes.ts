import { deleteEntry } from "./delete-entry";
import { listWaitlist } from "./list-waitlist";
import { notifyWaitlist } from "./notify-waitlist";
import { waitlistSummary } from "./waitlist-summary";

export const adminEndpoints = {
	"/admin/waitlist": listWaitlist,
	"/admin/waitlist/summary": waitlistSummary,
	"/admin/waitlist/:productId/notify": notifyWaitlist,
	"/admin/waitlist/:id/delete": deleteEntry,
};
