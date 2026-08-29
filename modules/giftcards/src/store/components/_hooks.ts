"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useGiftCardApi() {
	const client = useModuleClient();
	return {
		check: client.module("gift-cards").store["/gift-cards/check"],
	};
}
