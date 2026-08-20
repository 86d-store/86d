"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

export function useDiscountsApi() {
	const client = useModuleClient();
	return {
		validate: client.module("discounts").store["/discounts/validate"],
		active: client.module("discounts").store["/discounts/active"],
		evaluateCartRules:
			client.module("discounts").store["/discounts/cart-rules/evaluate"],
	};
}
