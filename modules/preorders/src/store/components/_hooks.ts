"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function usePreordersApi() {
	const client = useModuleClient();
	return {
		listCampaigns: client.module("preorders").store["/preorders/campaigns"],
		getCampaign: client.module("preorders").store["/preorders/campaigns/:id"],
		checkAvailability:
			client.module("preorders").store["/preorders/check/:productId"],
		placePreorder: client.module("preorders").store["/preorders/place"],
		myPreorders: client.module("preorders").store["/preorders/mine"],
		cancelPreorder: client.module("preorders").store["/preorders/:id/cancel"],
	};
}
