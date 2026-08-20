"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useComparisonApi() {
	const client = useModuleClient();
	return {
		listComparison: client.module("comparisons").store["/comparisons"],
		addProduct: client.module("comparisons").store["/comparisons/add"],
		removeProduct: client.module("comparisons").store["/comparisons/remove"],
		clearComparison: client.module("comparisons").store["/comparisons/clear"],
		mergeComparison: client.module("comparisons").store["/comparisons/merge"],
	};
}
