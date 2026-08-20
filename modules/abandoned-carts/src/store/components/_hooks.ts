"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useAbandonedCartApi() {
	const client = useModuleClient();
	return {
		track: client.module("abandoned-carts").store["/abandoned-carts/track"],
		recover:
			client.module("abandoned-carts").store["/abandoned-carts/recover/:token"],
	};
}
