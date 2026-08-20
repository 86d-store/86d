"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useRecentlyViewedApi() {
	const client = useModuleClient();
	return {
		listViews: client.module("recently-viewed").store["/recently-viewed"],
		trackView: client.module("recently-viewed").store["/recently-viewed/track"],
		clearHistory:
			client.module("recently-viewed").store["/recently-viewed/clear"],
		mergeHistory:
			client.module("recently-viewed").store["/recently-viewed/merge"],
	};
}
