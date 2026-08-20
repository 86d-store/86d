/**
 * Google Analytics 4 Measurement Protocol provider.
 * Forwards analytics events server-side to GA4 via the Measurement Protocol.
 * https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

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

export interface GA4Event {
	name: string;
	params: Record<string, unknown>;
}

export interface GA4SendResult {
	success: boolean;
	error?: string | undefined;
}

export class GA4Provider {
	private readonly measurementId: string;
	private readonly apiSecret: string;
	private readonly baseUrl = "https://www.google-analytics.com/mp/collect";

	constructor(measurementId: string, apiSecret: string) {
		this.measurementId = measurementId;
		this.apiSecret = apiSecret;
	}

	/**
	 * Map an analytics event to a GA4 Measurement Protocol event.
	 * Converts internal event types to GA4 recommended names and maps
	 * fields to GA4 parameter conventions.
	 */
	mapEvent(params: {
		type: string;
		sessionId?: string | undefined;
		customerId?: string | undefined;
		productId?: string | undefined;
		orderId?: string | undefined;
		value?: number | undefined;
		data?: Record<string, unknown> | undefined;
	}): GA4Event {
		const eventName = GA4_EVENT_MAP[params.type] ?? params.type;
		const eventParams: Record<string, unknown> = {};

		if (params.sessionId) eventParams.session_id = params.sessionId;
		if (params.productId) eventParams.item_id = params.productId;
		if (params.orderId) eventParams.transaction_id = params.orderId;
		if (params.value !== undefined) eventParams.value = params.value / 100;

		if (params.data) {
			for (const [key, val] of Object.entries(params.data)) {
				eventParams[key] = val;
			}
		}

		return { name: eventName, params: eventParams };
	}

	/**
	 * Send an event to GA4 via the Measurement Protocol.
	 * Fire-and-forget: returns a result but callers should not await in the
	 * critical path.
	 */
	async send(params: {
		clientId: string;
		userId?: string | undefined;
		events: GA4Event[];
	}): Promise<GA4SendResult> {
		const url = `${this.baseUrl}?measurement_id=${encodeURIComponent(this.measurementId)}&api_secret=${encodeURIComponent(this.apiSecret)}`;

		const body = {
			client_id: params.clientId,
			...(params.userId ? { user_id: params.userId } : {}),
			events: params.events,
		};

		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		if (!res.ok) {
			const text = await res.text().catch(() => `HTTP ${res.status}`);
			return {
				success: false,
				error: `GA4 Measurement Protocol error: ${text}`,
			};
		}

		return { success: true };
	}

	/**
	 * Validate an event payload against the GA4 Measurement Protocol
	 * debug endpoint. Useful for testing — returns validation messages.
	 */
	async validate(params: {
		clientId: string;
		userId?: string | undefined;
		events: GA4Event[];
	}): Promise<{ validationMessages: Array<{ description: string }> }> {
		const url = `https://www.google-analytics.com/debug/mp/collect?measurement_id=${encodeURIComponent(this.measurementId)}&api_secret=${encodeURIComponent(this.apiSecret)}`;

		const body = {
			client_id: params.clientId,
			...(params.userId ? { user_id: params.userId } : {}),
			events: params.events,
		};

		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		if (!res.ok) {
			return {
				validationMessages: [{ description: `HTTP ${res.status}` }],
			};
		}

		return (await res.json()) as {
			validationMessages: Array<{ description: string }>;
		};
	}

	/**
	 * Verify the measurement ID and API secret work by sending a single
	 * valid event to the debug endpoint. Returns ok when the Measurement
	 * Protocol reports no validation errors; otherwise returns the first
	 * validation message or the transport-level error.
	 */
	async verifyConnection(): Promise<
		{ ok: true } | { ok: false; error: string }
	> {
		try {
			const result = await this.validate({
				clientId: "86d-connection-check",
				events: [{ name: "page_view", params: {} }],
			});
			if (result.validationMessages.length === 0) {
				return { ok: true };
			}
			return {
				ok: false,
				error: result.validationMessages[0].description,
			};
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err.message : "Connection failed",
			};
		}
	}
}
