"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useStoreCreditApi() {
	const client = useModuleClient();
	return {
		balance: client.module("store-credits").store["/store-credits/balance"],
		transactions:
			client.module("store-credits").store["/store-credits/transactions"],
		apply: client.module("store-credits").store["/store-credits/apply"],
	};
}
