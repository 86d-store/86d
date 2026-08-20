"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useSearchApi() {
	const client = useModuleClient();
	return {
		search: client.module("search").store["/search"],
		suggest: client.module("search").store["/search/suggest"],
		recent: client.module("search").store["/search/recent"],
	};
}
