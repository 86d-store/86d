"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function usePaymentsStoreApi() {
	const client = useModuleClient();
	return {
		listMethods: client.module("payments").store["/payments/methods"],
		deleteMethod: client.module("payments").store["/payments/methods/:id"],
	};
}
