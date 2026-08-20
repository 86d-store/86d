"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useCustomerGroupApi() {
	const client = useModuleClient();
	return {
		myGroups: client.module("customer-groups").store["/customer-groups/mine"],
		myPricing:
			client.module("customer-groups").store["/customer-groups/pricing"],
		checkMembership:
			client.module("customer-groups").store["/customer-groups/check"],
	};
}
