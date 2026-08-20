"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useOrdersApi() {
	const client = useModuleClient();
	return {
		trackOrder: client.module("orders").store["/orders/track"],
		listMyOrders: client.module("orders").store["/orders/me"],
		listMyReturns: client.module("orders").store["/orders/me/returns"],
		getMyOrder: client.module("orders").store["/orders/me/:id"],
		cancelMyOrder: client.module("orders").store["/orders/me/:id/cancel"],
		getMyFulfillments:
			client.module("orders").store["/orders/me/:id/fulfillments"],
		getMyReturns: client.module("orders").store["/orders/me/:id/returns"],
		createReturn:
			client.module("orders").store["/orders/me/:id/returns/create"],
	};
}
