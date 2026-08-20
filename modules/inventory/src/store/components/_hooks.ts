"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useInventoryApi() {
	const client = useModuleClient();
	return {
		checkStock: client.module("inventory").store["/inventory/check"],
		subscribeBackInStock:
			client.module("inventory").store["/inventory/back-in-stock/subscribe"],
		checkBackInStock:
			client.module("inventory").store["/inventory/back-in-stock/check"],
		unsubscribeBackInStock:
			client.module("inventory").store["/inventory/back-in-stock/unsubscribe"],
	};
}
