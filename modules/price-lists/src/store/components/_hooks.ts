"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function usePriceListsStoreApi() {
	const client = useModuleClient();
	return {
		resolvePrice:
			client.module("price-lists").store["/prices/product/:productId"],
		resolvePrices: client.module("price-lists").store["/prices/products"],
		getPriceList: client.module("price-lists").store["/price-lists/:slug"],
	};
}
