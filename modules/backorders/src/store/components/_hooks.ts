"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useBackordersApi() {
	const client = useModuleClient();
	return {
		createBackorder: client.module("backorders").store["/backorders/create"],
		checkEligibility:
			client.module("backorders").store["/backorders/check/:productId"],
		myBackorders: client.module("backorders").store["/backorders/mine"],
		getBackorder: client.module("backorders").store["/backorders/:id"],
		cancelBackorder:
			client.module("backorders").store["/backorders/:id/cancel"],
	};
}
