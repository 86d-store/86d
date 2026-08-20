"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useBrandsApi() {
	const client = useModuleClient();
	return {
		listBrands: client.module("brands").store["/brands"],
		getFeatured: client.module("brands").store["/brands/featured"],
		getBrand: client.module("brands").store["/brands/:slug"],
		getBrandProducts: client.module("brands").store["/brands/:slug/products"],
		getProductBrand:
			client.module("brands").store["/brands/product/:productId"],
	};
}
