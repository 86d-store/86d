import { actorHistory } from "./actor-history";
import { getEntry } from "./get-entry";
import { listEntries } from "./list-entries";
import { purge } from "./purge";
import { resourceHistory } from "./resource-history";
import { summary } from "./summary";

export const adminEndpoints = {
	"/admin/audit-log/entries": listEntries,
	"/admin/audit-log/entries/:id": getEntry,
	"/admin/audit-log/resource/:resource/:resourceId": resourceHistory,
	"/admin/audit-log/actor/:actorId": actorHistory,
	"/admin/audit-log/summary": summary,
	"/admin/audit-log/purge": purge,
};
