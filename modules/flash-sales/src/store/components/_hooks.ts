"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useFlashSalesApi() {
	const client = useModuleClient();
	return {
		listActive: client.module("flash-sales").store["/flash-sales"],
		getSale: client.module("flash-sales").store["/flash-sales/:slug"],
		getProductDeal:
			client.module("flash-sales").store["/flash-sales/product/:productId"],
		getProductDeals:
			client.module("flash-sales").store["/flash-sales/products"],
	};
}

export function useCartMutation() {
	const client = useModuleClient();
	return {
		addToCart: client.module("cart").store["/cart"],
		getCart: client.module("cart").store["/cart/get"],
	};
}
