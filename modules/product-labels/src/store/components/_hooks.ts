"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useProductLabelsApi() {
	const client = useModuleClient();
	return {
		listLabels: client.module("product-labels").store["/product-labels"],
		getLabel: client.module("product-labels").store["/product-labels/:slug"],
		getProductLabels:
			client.module("product-labels").store[
				"/product-labels/products/:productId"
			],
	};
}
