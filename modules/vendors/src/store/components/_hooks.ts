"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useVendorsStoreApi() {
	const client = useModuleClient();
	return {
		listVendors: client.module("vendors").store["/vendors"],
		getVendor: client.module("vendors").store["/vendors/:slug"],
		vendorProducts:
			client.module("vendors").store["/vendors/:vendorId/products"],
		apply: client.module("vendors").store["/vendors/apply"],
	};
}
