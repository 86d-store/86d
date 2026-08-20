"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useBulkPricingApi() {
	const client = useModuleClient();
	return {
		resolve: client.module("bulk-pricing").store["/bulk-pricing/resolve"],
		getProductTiers:
			client.module("bulk-pricing").store[
				"/bulk-pricing/product/:productId/tiers"
			],
	};
}
