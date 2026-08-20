"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useShareApi() {
	const client = useModuleClient();
	return {
		share: client.module("social-sharing").store["/social-sharing/share"],
		getCount: client.module("social-sharing").store["/social-sharing/count"],
		getUrl: client.module("social-sharing").store["/social-sharing/url"],
	};
}
