"use client";

import { useModuleClient } from "@86d-store/core/client/provider";

export function useNewsletterApi() {
	const client = useModuleClient();
	return {
		subscribe: client.module("newsletter").store["/newsletter/subscribe"],
		unsubscribe: client.module("newsletter").store["/newsletter/unsubscribe"],
	};
}
