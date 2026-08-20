"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useNavigationApi() {
	const client = useModuleClient();
	return {
		listMenus: client.module("navigation").store["/navigation"],
		getByLocation:
			client.module("navigation").store["/navigation/location/:location"],
		getMenu: client.module("navigation").store["/navigation/:slug"],
	};
}
