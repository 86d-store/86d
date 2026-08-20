"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useKioskStoreApi() {
	const client = useModuleClient();
	return {
		startSession: client.module("kiosk").store["/kiosk/sessions"],
		getSession: client.module("kiosk").store["/kiosk/sessions/:id"],
		addItem: client.module("kiosk").store["/kiosk/sessions/:id/items"],
		removeItem:
			client.module("kiosk").store["/kiosk/sessions/:id/items/:itemId/delete"],
		updateItem:
			client.module("kiosk").store["/kiosk/sessions/:id/items/:itemId"],
		complete: client.module("kiosk").store["/kiosk/sessions/:id/complete"],
		heartbeat: client.module("kiosk").store["/kiosk/stations/:id/heartbeat"],
	};
}
