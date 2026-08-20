"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useRevenueStoreApi() {
	const client = useModuleClient();
	return {
		listTransactions: client.module("revenue").store["/revenue/transactions"],
	};
}
