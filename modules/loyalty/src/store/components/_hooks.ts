"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useLoyaltyApi() {
	const client = useModuleClient();
	return {
		getBalance: client.module("loyalty").store["/loyalty/balance"],
		listTransactions: client.module("loyalty").store["/loyalty/transactions"],
		getTiers: client.module("loyalty").store["/loyalty/tiers"],
		calculatePoints: client.module("loyalty").store["/loyalty/calculate"],
		redeem: client.module("loyalty").store["/loyalty/redeem"],
	};
}
