import { addNote } from "./add-note";
import { deleteNote } from "./delete-note";
import { listNotes } from "./list-notes";
import { updateNote } from "./update-note";

export const storeEndpoints = {
	"/orders/:orderId/notes": listNotes,
	"/orders/:orderId/notes/add": addNote,
	"/orders/notes/:noteId/update": updateNote,
	"/orders/notes/:noteId/delete": deleteNote,
};
