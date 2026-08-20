"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useCollectionsApi() {
	const client = useModuleClient();
	return {
		listCollections: client.module("products").store["/collections"],
		getCollection: client.module("products").store["/collections/:id"],
		getCollectionProducts:
			client.module("collections").store["/collections/:slug/products"],
		getFeatured: client.module("products").store["/collections"],
		getProductCollections:
			client.module("collections").store["/collections/product/:productId"],
	};
}
