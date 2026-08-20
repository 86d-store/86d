"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useRef } from "react";

/**
 * Supported event types for the analytics tracker.
 * Any string is also valid for custom events.
 */
export type AnalyticsEventType =
	| "pageView"
	| "productView"
	| "addToCart"
	| "removeFromCart"
	| "checkout"
	| "purchase"
	| "search"
	| (string & {});

interface TrackParams {
	type: AnalyticsEventType;
	productId?: string | undefined;
	orderId?: string | undefined;
	value?: number | undefined;
	data?: Record<string, unknown> | undefined;
}

/** Map internal event types to GA4 recommended event names. */
const GA4_EVENT_MAP: Record<string, string> = {
	pageView: "page_view",
	productView: "view_item",
	addToCart: "add_to_cart",
	removeFromCart: "remove_from_cart",
	checkout: "begin_checkout",
	purchase: "purchase",
	search: "search",
};

/**
 * Push an event to GTM's dataLayer when available.
 * Maps internal event types to GA4 recommended names.
 */
function pushToDataLayer(params: TrackParams) {
	if (typeof window === "undefined") return;
	const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
	const dataLayer = w.dataLayer;
	if (!dataLayer) return;

	const eventName = GA4_EVENT_MAP[params.type] ?? params.type;
	const event: Record<string, unknown> = { event: eventName };

	if (params.productId) event.item_id = params.productId;
	if (params.orderId) event.transaction_id = params.orderId;
	if (params.value !== undefined) event.value = params.value / 100;
	if (params.data) {
		for (const [key, val] of Object.entries(params.data)) {
			event[key] = val;
		}
	}

	dataLayer.push(event);
}

/**
 * Fire-and-forget analytics tracker.
 *
 * Returns a stable `track` function that sends events to `POST /analytics/events`
 * and also pushes to GTM's dataLayer when Google Tag Manager is configured.
 * Failures are silently swallowed — analytics should never break the UI.
 *
 * @example
 * ```tsx
 * const { track } = useAnalytics();
 * track({ type: "productView", productId: "abc" });
 * track({ type: "purchase", orderId: "ORD-123", value: 4999 });
 * ```
 */
export function useAnalytics() {
	const client = useModuleClient();
	const mutationRef = useRef(
		client.module("analytics").store["/analytics/events"],
	);
	mutationRef.current = client.module("analytics").store["/analytics/events"];

	const track = useCallback((params: TrackParams) => {
		try {
			void mutationRef.current.mutate({
				type: params.type,
				...(params.productId !== undefined
					? { productId: params.productId }
					: {}),
				...(params.orderId !== undefined ? { orderId: params.orderId } : {}),
				...(params.value !== undefined ? { value: params.value } : {}),
				...(params.data !== undefined ? { data: params.data } : {}),
			});
		} catch {
			// Swallow — analytics is best-effort
		}

		// Forward to GTM dataLayer (best-effort, no error propagation)
		try {
			pushToDataLayer(params);
		} catch {
			// Swallow — GTM forwarding is best-effort
		}
	}, []);

	return { track };
}
