"use client";

import { useModuleClient } from "@86d-store/core/client/provider";

export function useTaxApi() {
	const client = useModuleClient();
	return {
		getApplicableRates: client.module("tax").store["/tax/rates"],
	};
}
