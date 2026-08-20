"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useRef } from "react";

export function useCartApi() {
	const client = useModuleClient();
	return {
		getCart: client.module("cart").store["/cart/get"],
		addToCart: client.module("cart").store["/cart"],
		clearCart: client.module("cart").store["/cart/clear"],
		removeFromCart: client.module("cart").store["/cart/items/:id/remove"],
		updateCartItem: client.module("cart").store["/cart/items/:id/update"],
	};
}

/** Fire-and-forget analytics event via the analytics module endpoint. */
export function useTrack() {
	const client = useModuleClient();
	const tracker = client.module("analytics").store["/analytics/events"];
	const ref = useRef(tracker);
	ref.current = tracker;

	return useCallback(
		(params: {
			type: string;
			productId?: string;
			value?: number;
			data?: Record<string, unknown>;
		}) => {
			try {
				void ref.current.mutate(params);
			} catch {
				// Analytics is best-effort
			}
		},
		[],
	);
}
