"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useFulfillmentApi() {
	const client = useModuleClient();
	return {
		getFulfillment: client.module("fulfillment").store["/fulfillment/:id"],
		listByOrder:
			client.module("fulfillment").store["/fulfillment/order/:orderId"],
	};
}
