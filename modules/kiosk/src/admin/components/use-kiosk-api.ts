"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useKioskApi() {
	const client = useModuleClient();
	return {
		listStations: client.module("kiosk").admin["/admin/kiosk/stations"],
		listStationOptions:
			client.module("kiosk").admin["/admin/kiosk/station-options"],
		createStation: client.module("kiosk").admin["/admin/kiosk/stations/create"],
		updateStation: client.module("kiosk").admin["/admin/kiosk/stations/:id"],
		listSessions: client.module("kiosk").admin["/admin/kiosk/sessions"],
	};
}
