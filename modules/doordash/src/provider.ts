/**
 * DoorDash Drive API v2 provider.
 * Makes real HTTP calls to https://openapi.doordash.com/drive/v2/.
 * Authentication uses HS256 JWTs signed with developer credentials.
 */

interface DoordashCredentials {
	developerId: string;
	keyId: string;
	signingSecret: string;
}

// ── DoorDash Drive API types ─────────────────────────────────────────────────

export type DriveDeliveryStatus =
	| "created"
	| "confirmed"
	| "enroute_to_pickup"
	| "arrived_at_pickup"
	| "picked_up"
	| "enroute_to_dropoff"
	| "arrived_at_dropoff"
	| "delivered"
	| "cancelled";

export interface DriveAddress {
	street: string;
	city?: string | undefined;
	state?: string | undefined;
	zip_code?: string | undefined;
	country?: string | undefined;
	subpremise?: string | undefined;
}

export interface DriveDeliveryResponse {
	external_delivery_id: string;
	delivery_status: DriveDeliveryStatus;
	currency: string;
	fee: number;
	tip: number;
	order_value: number;
	pickup_address: string;
	pickup_business_name: string;
	pickup_phone_number: string;
	pickup_instructions: string;
	dropoff_address: string;
	dropoff_business_name: string;
	dropoff_phone_number: string;
	dropoff_instructions: string;
	pickup_time_estimated: string | null;
	dropoff_time_estimated: string | null;
	pickup_time_actual: string | null;
	dropoff_time_actual: string | null;
	dasher_id: number | null;
	dasher_name: string | null;
	dasher_dropoff_phone_number: string | null;
	tracking_url: string | null;
	support_reference: string;
	created_at: string;
	updated_at: string;
}

export interface DriveQuoteResponse {
	external_delivery_id: string;
	currency: string;
	fee: number;
	delivery_status: DriveDeliveryStatus;
	pickup_time_estimated: string | null;
	dropoff_time_estimated: string | null;
}

export interface DriveErrorResponse {
	code: string;
	message: string;
	field_errors?: Array<{ field: string; error: string }> | undefined;
}

export interface CreateDeliveryParams {
	externalDeliveryId: string;
	pickupAddress: string;
	pickupBusinessName: string;
	pickupPhoneNumber: string;
	pickupInstructions?: string | undefined;
	dropoffAddress: string;
	dropoffBusinessName: string;
	dropoffPhoneNumber: string;
	dropoffInstructions?: string | undefined;
	orderValue: number;
	tip?: number | undefined;
}

export interface CreateQuoteParams {
	externalDeliveryId: string;
	pickupAddress: string;
	pickupBusinessName: string;
	pickupPhoneNumber: string;
	dropoffAddress: string;
	dropoffBusinessName: string;
	dropoffPhoneNumber: string;
	orderValue: number;
}

// ── JWT generation ───────────────────────────────────────────────────────────

const enc = new TextEncoder();

function base64UrlEncode(data: Uint8Array): string {
	const binary = Array.from(data)
		.map((b) => String.fromCharCode(b))
		.join("");
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function base64UrlEncodeString(str: string): string {
	return base64UrlEncode(enc.encode(str));
}

/**
 * Decode a base64-encoded signing secret.
 * DoorDash signing secrets are standard base64 (not URL-safe).
 */
function decodeSigningSecret(secret: string): Uint8Array {
	const binary = atob(secret);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

async function createJwt(credentials: DoordashCredentials): Promise<string> {
	const now = Math.floor(Date.now() / 1000);

	const header = {
		alg: "HS256",
		typ: "JWT",
		"dd-ver": "DD-JWT-V1",
	};

	const payload = {
		aud: "doordash",
		iss: credentials.developerId,
		kid: credentials.keyId,
		exp: now + 300,
		iat: now,
	};

	const headerB64 = base64UrlEncodeString(JSON.stringify(header));
	const payloadB64 = base64UrlEncodeString(JSON.stringify(payload));
	const signingInput = `${headerB64}.${payloadB64}`;

	const secretBytes = decodeSigningSecret(credentials.signingSecret);
	const key = await crypto.subtle.importKey(
		"raw",
		secretBytes.buffer as ArrayBuffer,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		enc.encode(signingInput),
	);

	const signatureB64 = base64UrlEncode(new Uint8Array(signature));
	return `${signingInput}.${signatureB64}`;
}

// ── Provider class ───────────────────────────────────────────────────────────

export class DoordashDriveProvider {
	private readonly credentials: DoordashCredentials;
	private readonly baseUrl: string;

	constructor(credentials: DoordashCredentials, sandbox = true) {
		this.credentials = credentials;
		this.baseUrl = sandbox
			? "https://openapi.doordash.com/drive/v2"
			: "https://openapi.doordash.com/drive/v2";
	}

	private async request<T>(
		method: "GET" | "POST" | "PUT" | "PATCH",
		path: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const token = await createJwt(this.credentials);
		const res = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});

		const json = (await res.json()) as T | DriveErrorResponse;
		if (!res.ok) {
			const err = json as DriveErrorResponse;
			throw new Error(
				`DoorDash API error: ${err.message ?? `HTTP ${res.status}`} (${err.code ?? "unknown"})`,
			);
		}
		return json as T;
	}

	async createDelivery(
		params: CreateDeliveryParams,
	): Promise<DriveDeliveryResponse> {
		return this.request<DriveDeliveryResponse>("POST", "/deliveries", {
			external_delivery_id: params.externalDeliveryId,
			pickup_address: params.pickupAddress,
			pickup_business_name: params.pickupBusinessName,
			pickup_phone_number: params.pickupPhoneNumber,
			pickup_instructions: params.pickupInstructions ?? "",
			dropoff_address: params.dropoffAddress,
			dropoff_business_name: params.dropoffBusinessName,
			dropoff_phone_number: params.dropoffPhoneNumber,
			dropoff_instructions: params.dropoffInstructions ?? "",
			order_value: params.orderValue,
			tip: params.tip ?? 0,
		});
	}

	async getDelivery(
		externalDeliveryId: string,
	): Promise<DriveDeliveryResponse> {
		return this.request<DriveDeliveryResponse>(
			"GET",
			`/deliveries/${encodeURIComponent(externalDeliveryId)}`,
		);
	}

	async cancelDelivery(
		externalDeliveryId: string,
	): Promise<DriveDeliveryResponse> {
		return this.request<DriveDeliveryResponse>(
			"PUT",
			`/deliveries/${encodeURIComponent(externalDeliveryId)}/cancel`,
			{},
		);
	}

	async createQuote(params: CreateQuoteParams): Promise<DriveQuoteResponse> {
		return this.request<DriveQuoteResponse>("POST", "/quotes", {
			external_delivery_id: params.externalDeliveryId,
			pickup_address: params.pickupAddress,
			pickup_business_name: params.pickupBusinessName,
			pickup_phone_number: params.pickupPhoneNumber,
			dropoff_address: params.dropoffAddress,
			dropoff_business_name: params.dropoffBusinessName,
			dropoff_phone_number: params.dropoffPhoneNumber,
			order_value: params.orderValue,
		});
	}

	async acceptQuote(
		externalDeliveryId: string,
	): Promise<DriveDeliveryResponse> {
		return this.request<DriveDeliveryResponse>(
			"POST",
			`/quotes/${encodeURIComponent(externalDeliveryId)}/accept`,
			{},
		);
	}

	/**
	 * Verify API credentials by listing deliveries.
	 * DoorDash has no /account endpoint, so we use GET /deliveries as an auth check.
	 */
	async verifyConnection(): Promise<
		{ ok: true; accountName: string } | { ok: false; error: string }
	> {
		try {
			await this.request<unknown>("GET", "/deliveries");
			return {
				ok: true,
				accountName: `DoorDash Drive (${this.credentials.developerId.slice(0, 8)}...)`,
			};
		} catch (e) {
			return {
				ok: false,
				error: e instanceof Error ? e.message : String(e),
			};
		}
	}
}

// ── Status mapping ───────────────────────────────────────────────────────────

import type { DeliveryStatus } from "./service";

export function mapDriveStatusToInternal(
	status: DriveDeliveryStatus,
): DeliveryStatus {
	switch (status) {
		case "created":
			return "pending";
		case "confirmed":
		case "enroute_to_pickup":
		case "arrived_at_pickup":
			return "accepted";
		case "picked_up":
		case "enroute_to_dropoff":
		case "arrived_at_dropoff":
			return "picked-up";
		case "delivered":
			return "delivered";
		case "cancelled":
			return "cancelled";
		default:
			return "pending";
	}
}

// ── Export JWT creation for testing ──────────────────────────────────────────

export { createJwt };
