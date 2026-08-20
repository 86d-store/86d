"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useBundleApi() {
	const client = useModuleClient();
	return {
		list: client.module("bundles").store["/bundles"],
		get: client.module("bundles").store["/bundles/:slug"],
	};
}
