"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useCurrencyApi() {
	const client = useModuleClient();
	return {
		listCurrencies: client.module("multi-currency").store["/currencies"],
		convert: client.module("multi-currency").store["/currencies/convert"],
		productPrice:
			client.module("multi-currency").store["/currencies/product-price"],
	};
}
