"use client";

import { useModuleClient } from "@86d-store/core/client/provider";

export function useShippingApi() {
	const client = useModuleClient();
	return {
		calculateRates: client.module("shipping").store["/shipping/calculate"],
	};
}
