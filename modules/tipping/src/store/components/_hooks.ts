"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useTippingStoreApi() {
	const client = useModuleClient();
	return {
		getSettings: client.module("tipping").store["/tipping/settings"],
		getOrderTips:
			client.module("tipping").store["/tipping/tips/order/:orderId"],
		addTip: client.module("tipping").store["/tipping/tips"],
		updateTip: client.module("tipping").store["/tipping/tips/:id"],
		removeTip: client.module("tipping").store["/tipping/tips/:id/delete"],
	};
}
