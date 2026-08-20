"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useAffiliatesStoreApi() {
	const client = useModuleClient();
	return {
		apply: client.module("affiliates").store["/affiliates/apply"],
		dashboard: client.module("affiliates").store["/affiliates/dashboard"],
		myLinks: client.module("affiliates").store["/affiliates/my-links"],
		createLink: client.module("affiliates").store["/affiliates/links/create"],
	};
}
