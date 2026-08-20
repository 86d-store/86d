"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useMediaApi() {
	const client = useModuleClient();
	return {
		listAssets: client.module("media").store["/media"],
		getAsset: client.module("media").store["/media/:id"],
	};
}
