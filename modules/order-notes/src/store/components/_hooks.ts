"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useOrderNotesApi() {
	const client = useModuleClient();
	return {
		listNotes: client.module("order-notes").store["/orders/:orderId/notes"],
		addNote: client.module("order-notes").store["/orders/:orderId/notes/add"],
		updateNote:
			client.module("order-notes").store["/orders/notes/:noteId/update"],
		deleteNote:
			client.module("order-notes").store["/orders/notes/:noteId/delete"],
	};
}
