"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useStoreLocatorApi() {
	const client = useModuleClient();
	return {
		listLocations: client.module("store-locator").store["/locations"],
		searchNearby: client.module("store-locator").store["/locations/nearby"],
		getRegions: client.module("store-locator").store["/locations/regions"],
		getLocation: client.module("store-locator").store["/locations/:slug"],
		checkHours: client.module("store-locator").store["/locations/:id/hours"],
	};
}
