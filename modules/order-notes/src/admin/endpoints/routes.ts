import { adminAddNote } from "./admin-add-note";
import { adminDeleteNote } from "./admin-delete-note";
import { listAllNotes } from "./list-all-notes";
import { notesSummary } from "./notes-summary";
import { togglePin } from "./toggle-pin";

export const adminEndpoints = {
	"/admin/order-notes": listAllNotes,
	"/admin/order-notes/add": adminAddNote,
	"/admin/order-notes/summary": notesSummary,
	"/admin/order-notes/:id/delete": adminDeleteNote,
	"/admin/order-notes/:id/toggle-pin": togglePin,
};
