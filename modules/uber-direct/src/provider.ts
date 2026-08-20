/**
 * Uber Direct API provider.
 * Makes real HTTP calls to https://api.uber.com/v1/customers/{customerId}/.
 * Authentication uses OAuth 2.0 client credentials flow.
 *
 * API reference: https://developer.uber.com/docs/deliveries
 * SDK types: https://github.com/uber/uber-direct-sdk
 */

// ── Uber Direct API types ───────────────────────────────────────────────────

export type UberDeliveryStatus =
	| "pending"
	| "pickup"
	| "pickup_complete"
	| "dropoff"
	| "delivered"
	| "canceled"
	| "returned";

export interface UberWaypointInfo {
	name?: string | undefined;
	phone_number?: string | undefined;
	address?: string | undefined;
	detailed_address?: UberAddress | undefined;
	notes?: string | undefined;
	seller_notes?: string | undefined;
	courier_notes?: string | undefined;
	location?: UberLatLng | undefined;
	status?: string | undefined;
	status_timestamp?: string | undefined;
	external_store_id?: string | undefined;
}

export interface UberAddress {
	street_address_1?: string | undefined;
	street_address_2?: string | undefined;
	city?: string | undefined;
	state?: string | undefined;
	zip_code?: string | undefined;
	country?: string | undefined;
}

export interface UberLatLng {
	lat?: number | undefined;
	lng?: number | undefined;
}

export interface UberManifestItem {
	name?: string | undefined;
	quantity?: number | undefined;
	size?: "small" | "medium" | "large" | "xlarge" | undefined;
	price?: number | undefined;
	weight?: number | undefined;
	must_be_upright?: boolean | undefined;
	dimensions?: { length?: number; height?: number; depth?: number } | undefined;
}

export interface UberCourierInfo {
	name?: string | undefined;
	rating?: number | undefined;
	vehicle_type?: string | undefined;
	phone_number?: string | undefined;
	location?: UberLatLng | undefined;
	img_href?: string | undefined;
}

export interface UberQuoteRequest {
	pickup_address: string;
	dropoff_address: string;
	pickup_latitude?: number | undefined;
	pickup_longitude?: number | undefined;
	dropoff_latitude?: number | undefined;
	dropoff_longitude?: number | undefined;
	pickup_ready_dt?: string | undefined;
	pickup_deadline_dt?: string | undefined;
	dropoff_ready_dt?: string | undefined;
	dropoff_deadline_dt?: string | undefined;
	pickup_phone_number?: string | undefined;
	dropoff_phone_number?: string | undefined;
	manifest_total_value?: number | undefined;
	external_store_id?: string | undefined;
}

export interface UberQuoteResponse {
	kind?: string | undefined;
	id?: string | undefined;
	created?: string | undefined;
	expires?: string | undefined;
	fee?: number | undefined;
	currency?: string | undefined;
	currency_type?: string | undefined;
	dropoff_eta?: string | undefined;
	duration?: number | undefined;
	pickup_duration?: number | undefined;
	dropoff_deadline?: string | undefined;
}

export interface UberDeliveryRequest {
	pickup_name: string;
	pickup_address: string;
	pickup_phone_number: string;
	dropoff_name: string;
	dropoff_address: string;
	dropoff_phone_number: string;
	manifest_items: UberManifestItem[];
	pickup_business_name?: string | undefined;
	pickup_latitude?: number | undefined;
	pickup_longitude?: number | undefined;
	pickup_notes?: string | undefined;
	dropoff_business_name?: string | undefined;
	dropoff_latitude?: number | undefined;
	dropoff_longitude?: number | undefined;
	dropoff_notes?: string | undefined;
	dropoff_seller_notes?: string | undefined;
	manifest_reference?: string | undefined;
	manifest_total_value?: number | undefined;
	quote_id?: string | undefined;
	pickup_ready_dt?: string | undefined;
	pickup_deadline_dt?: string | undefined;
	dropoff_ready_dt?: string | undefined;
	dropoff_deadline_dt?: string | undefined;
	tip?: number | undefined;
	idempotency_key?: string | undefined;
	external_id?: string | undefined;
	external_store_id?: string | undefined;
}

export interface UberDeliveryResponse {
	id?: string | undefined;
	quote_id?: string | undefined;
	complete?: boolean | undefined;
	courier?: UberCourierInfo | undefined;
	courier_imminent?: boolean | undefined;
	created?: string | undefined;
	currency?: string | undefined;
	dropoff?: UberWaypointInfo | undefined;
	dropoff_deadline?: string | undefined;
	dropoff_eta?: string | undefined;
	dropoff_identifier?: string | undefined;
	dropoff_ready?: string | undefined;
	external_id?: string | undefined;
	fee?: number | undefined;
	kind?: string | undefined;
	live_mode?: boolean | undefined;
	manifest?: { reference?: string; description?: string; total_value?: number };
	pickup?: UberWaypointInfo | undefined;
	pickup_deadline?: string | undefined;
	pickup_eta?: string | undefined;
	pickup_ready?: string | undefined;
	status?: UberDeliveryStatus | undefined;
	tip?: number | undefined;
	tracking_url?: string | undefined;
	updated?: string | undefined;
	uuid?: string | undefined;
}

export interface UberListDeliveriesResponse {
	data?: UberDeliveryResponse[] | undefined;
	next_href?: string | undefined;
	total_count?: number | undefined;
}

export interface UberErrorResponse {
	code?: string | undefined;
	message?: string | undefined;
	kind?: string | undefined;
}

// ── Credentials ─────────────────────────────────────────────────────────────

interface UberDirectCredentials {
	clientId: string;
	clientSecret: string;
	customerId: string;
}

// ── OAuth token management ──────────────────────────────────────────────────

interface OAuthToken {
	accessToken: string;
	expiresAt: number;
}

// ── Provider class ──────────────────────────────────────────────────────────

export class UberDirectProvider {
	private readonly credentials: UberDirectCredentials;
	private readonly baseUrl: string;
	private readonly tokenUrl = "https://auth.uber.com/oauth/v2/token";
	private cachedToken: OAuthToken | null = null;

	constructor(credentials: UberDirectCredentials) {
		this.credentials = credentials;
		this.baseUrl = `https://api.uber.com/v1/customers/${encodeURIComponent(credentials.customerId)}`;
	}

	/**
	 * Get a valid OAuth access token, using cached token if not expired.
	 * Tokens are valid for 30 days but we refresh with a 5-minute buffer.
	 */
	async getAccessToken(): Promise<string> {
		if (
			this.cachedToken &&
			this.cachedToken.expiresAt > Date.now() + 5 * 60 * 1000
		) {
			return this.cachedToken.accessToken;
		}

		const body = new URLSearchParams({
			client_id: this.credentials.clientId,
			client_secret: this.credentials.clientSecret,
			grant_type: "client_credentials",
			scope: "eats.deliveries",
		});

		const res = await fetch(this.tokenUrl, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: body.toString(),
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(
				`Uber OAuth error: HTTP ${res.status} — ${text.slice(0, 200)}`,
			);
		}

		const json = (await res.json()) as {
			access_token: string;
			expires_in: number;
			token_type: string;
			scope: string;
		};

		this.cachedToken = {
			accessToken: json.access_token,
			expiresAt: Date.now() + json.expires_in * 1000,
		};

		return this.cachedToken.accessToken;
	}

	private async request<T>(
		method: "GET" | "POST",
		path: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const token = await this.getAccessToken();
		const url = `${this.baseUrl}${path}`;

		const res = await fetch(url, {
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});

		const json = (await res.json()) as T | UberErrorResponse;
		if (!res.ok) {
			const err = json as UberErrorResponse;
			throw new Error(
				`Uber Direct API error: ${err.message ?? `HTTP ${res.status}`} (${err.code ?? "unknown"})`,
			);
		}
		return json as T;
	}

	async createQuote(params: UberQuoteRequest): Promise<UberQuoteResponse> {
		return this.request<UberQuoteResponse>(
			"POST",
			"/delivery_quotes",
			params as unknown as Record<string, unknown>,
		);
	}

	async createDelivery(
		params: UberDeliveryRequest,
	): Promise<UberDeliveryResponse> {
		return this.request<UberDeliveryResponse>(
			"POST",
			"/deliveries",
			params as unknown as Record<string, unknown>,
		);
	}

	async getDelivery(deliveryId: string): Promise<UberDeliveryResponse> {
		return this.request<UberDeliveryResponse>(
			"GET",
			`/deliveries/${encodeURIComponent(deliveryId)}`,
		);
	}

	async cancelDelivery(deliveryId: string): Promise<UberDeliveryResponse> {
		return this.request<UberDeliveryResponse>(
			"POST",
			`/deliveries/${encodeURIComponent(deliveryId)}/cancel`,
			{},
		);
	}

	async listDeliveries(params?: {
		filter?: string;
		limit?: number;
	}): Promise<UberListDeliveriesResponse> {
		const query = new URLSearchParams();
		if (params?.filter) query.set("filter", params.filter);
		if (params?.limit) query.set("limit", String(params.limit));
		const qs = query.toString();
		const path = `/deliveries${qs ? `?${qs}` : ""}`;
		return this.request<UberListDeliveriesResponse>("GET", path);
	}

	/**
	 * Verify API credentials by obtaining an OAuth token.
	 * If the client_credentials flow succeeds, the credentials are valid.
	 */
	async verifyConnection(): Promise<
		{ ok: true; accountName: string } | { ok: false; error: string }
	> {
		try {
			await this.getAccessToken();
			return {
				ok: true,
				accountName: `Uber Direct (${this.credentials.customerId.slice(0, 8)}...)`,
			};
		} catch (e) {
			return {
				ok: false,
				error: e instanceof Error ? e.message : String(e),
			};
		}
	}
}

// ── Status mapping ──────────────────────────────────────────────────────────

import type { Delivery } from "./service";

/**
 * Map Uber Direct delivery statuses to internal module statuses.
 *
 * Uber statuses: pending, pickup, pickup_complete, dropoff, delivered, canceled, returned
 * Internal statuses: pending, quoted, accepted, picked-up, delivered, cancelled, failed
 */
export function mapUberStatusToInternal(
	status: UberDeliveryStatus,
): Delivery["status"] {
	switch (status) {
		case "pending":
			return "pending";
		case "pickup":
			return "accepted";
		case "pickup_complete":
			return "picked-up";
		case "dropoff":
			return "picked-up";
		case "delivered":
			return "delivered";
		case "canceled":
			return "cancelled";
		case "returned":
			return "failed";
		default:
			return "pending";
	}
}

// ── Webhook signature verification ──────────────────────────────────────────

const enc = new TextEncoder();

/**
 * Verify Uber Direct webhook signature using HMAC-SHA256.
 * Uber sends the signature in the `x-uber-signature` header.
 */
export async function verifyWebhookSignature(
	payload: string,
	signature: string,
	signingKey: string,
): Promise<boolean> {
	if (!/^[0-9a-fA-F]{64}$/.test(signature)) return false;

	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(signingKey),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["verify"],
	);

	const signatureBytes = Uint8Array.from(
		signature.match(/.{2}/g) ?? [],
		(byte) => Number.parseInt(byte, 16),
	);
	return crypto.subtle.verify("HMAC", key, signatureBytes, enc.encode(payload));
}
