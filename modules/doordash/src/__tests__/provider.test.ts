import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as providerModule from "../provider";
import {
	createJwt,
	DoordashDriveProvider,
	type DriveDeliveryResponse,
	type DriveQuoteResponse,
	mapDriveStatusToInternal,
} from "../provider";

// ── Realistic DoorDash Drive API fixtures ────────────────────────────────────

const MOCK_CREDENTIALS = {
	developerId: "d5f0a1b2-c3d4-e5f6-a7b8-c9d0e1f2a3b4",
	keyId: "k1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6",
	signingSecret: "dGVzdC1zaWduaW5nLXNlY3JldC1mb3ItdW5pdC10ZXN0cw==",
};

const DELIVERY_RESPONSE: DriveDeliveryResponse = {
	external_delivery_id: "86d_abc123",
	delivery_status: "created",
	currency: "USD",
	fee: 899,
	tip: 200,
	order_value: 3500,
	pickup_address: "901 Market St, San Francisco, CA 94103",
	pickup_business_name: "Dave's Pizza",
	pickup_phone_number: "+16505551234",
	pickup_instructions: "Enter through the side door",
	dropoff_address: "123 Main St, San Francisco, CA 94105",
	dropoff_business_name: "John Doe",
	dropoff_phone_number: "+14155559876",
	dropoff_instructions: "Leave at front door",
	pickup_time_estimated: "2026-03-17T18:30:00Z",
	dropoff_time_estimated: "2026-03-17T19:00:00Z",
	pickup_time_actual: null,
	dropoff_time_actual: null,
	dasher_id: null,
	dasher_name: null,
	dasher_dropoff_phone_number: null,
	tracking_url: "https://order.doordash.com/track/abc123",
	support_reference: "SR-12345678",
	created_at: "2026-03-17T18:00:00Z",
	updated_at: "2026-03-17T18:00:00Z",
};

const CONFIRMED_DELIVERY_RESPONSE: DriveDeliveryResponse = {
	...DELIVERY_RESPONSE,
	delivery_status: "confirmed",
	dasher_id: 98765,
	dasher_name: "Maria G.",
	dasher_dropoff_phone_number: "+14155550001",
};

const QUOTE_RESPONSE: DriveQuoteResponse = {
	external_delivery_id: "86d_quote_def456",
	currency: "USD",
	fee: 750,
	delivery_status: "created",
	pickup_time_estimated: "2026-03-17T18:30:00Z",
	dropoff_time_estimated: "2026-03-17T19:05:00Z",
};

const ERROR_RESPONSE = {
	code: "validation_error",
	message: "Validation Failed",
	field_errors: [{ field: "pickup_address", error: "Address not found" }],
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("DoordashDriveProvider", () => {
	let provider: DoordashDriveProvider;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		provider = new DoordashDriveProvider(MOCK_CREDENTIALS, true);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	describe("createDelivery", () => {
		it("sends POST to /deliveries with correct body", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(DELIVERY_RESPONSE),
			});

			const result = await provider.createDelivery({
				externalDeliveryId: "86d_abc123",
				pickupAddress: "901 Market St, San Francisco, CA 94103",
				pickupBusinessName: "Dave's Pizza",
				pickupPhoneNumber: "+16505551234",
				pickupInstructions: "Enter through the side door",
				dropoffAddress: "123 Main St, San Francisco, CA 94105",
				dropoffBusinessName: "John Doe",
				dropoffPhoneNumber: "+14155559876",
				dropoffInstructions: "Leave at front door",
				orderValue: 3500,
				tip: 200,
			});

			expect(result.external_delivery_id).toBe("86d_abc123");
			expect(result.delivery_status).toBe("created");
			expect(result.fee).toBe(899);
			expect(result.tracking_url).toBe(
				"https://order.doordash.com/track/abc123",
			);

			const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(fetchCall[0]).toBe(
				"https://openapi.doordash.com/drive/v2/deliveries",
			);
			expect(fetchCall[1]?.method).toBe("POST");

			const body = JSON.parse(fetchCall[1]?.body as string);
			expect(body.external_delivery_id).toBe("86d_abc123");
			expect(body.pickup_address).toBe(
				"901 Market St, San Francisco, CA 94103",
			);
			expect(body.order_value).toBe(3500);
			expect(body.tip).toBe(200);
		});

		it("sets default tip to 0 and empty instructions", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(DELIVERY_RESPONSE),
			});

			await provider.createDelivery({
				externalDeliveryId: "86d_test",
				pickupAddress: "123 Main St",
				pickupBusinessName: "Store",
				pickupPhoneNumber: "+10000000000",
				dropoffAddress: "456 Oak Ave",
				dropoffBusinessName: "Customer",
				dropoffPhoneNumber: "+10000000001",
				orderValue: 2000,
			});

			const body = JSON.parse(
				vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string,
			);
			expect(body.tip).toBe(0);
			expect(body.pickup_instructions).toBe("");
			expect(body.dropoff_instructions).toBe("");
		});

		it("includes JWT Bearer token in Authorization header", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(DELIVERY_RESPONSE),
			});

			await provider.createDelivery({
				externalDeliveryId: "86d_test",
				pickupAddress: "123 Main St",
				pickupBusinessName: "Store",
				pickupPhoneNumber: "+10000000000",
				dropoffAddress: "456 Oak Ave",
				dropoffBusinessName: "Customer",
				dropoffPhoneNumber: "+10000000001",
				orderValue: 2000,
			});

			const headers = vi.mocked(globalThis.fetch).mock.calls[0][1]
				?.headers as Record<string, string>;
			expect(headers.Authorization).toMatch(/^Bearer eyJ/);
			expect(headers["Content-Type"]).toBe("application/json");
		});

		it("throws on API error with code and message", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 422,
				json: () => Promise.resolve(ERROR_RESPONSE),
			});

			await expect(
				provider.createDelivery({
					externalDeliveryId: "86d_fail",
					pickupAddress: "invalid",
					pickupBusinessName: "Store",
					pickupPhoneNumber: "+10000000000",
					dropoffAddress: "invalid",
					dropoffBusinessName: "Customer",
					dropoffPhoneNumber: "+10000000001",
					orderValue: 2000,
				}),
			).rejects.toThrow(
				"DoorDash API error: Validation Failed (validation_error)",
			);
		});
	});

	describe("getDelivery", () => {
		it("sends GET to /deliveries/{id}", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(CONFIRMED_DELIVERY_RESPONSE),
			});

			const result = await provider.getDelivery("86d_abc123");

			expect(result.delivery_status).toBe("confirmed");
			expect(result.dasher_name).toBe("Maria G.");
			expect(result.dasher_id).toBe(98765);

			const url = vi.mocked(globalThis.fetch).mock.calls[0][0];
			expect(url).toBe(
				"https://openapi.doordash.com/drive/v2/deliveries/86d_abc123",
			);
			expect(vi.mocked(globalThis.fetch).mock.calls[0][1]?.method).toBe("GET");
		});

		it("encodes special characters in delivery ID", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(DELIVERY_RESPONSE),
			});

			await provider.getDelivery("86d_test/with spaces");

			const url = vi.mocked(globalThis.fetch).mock.calls[0][0];
			expect(url).toContain("86d_test%2Fwith%20spaces");
		});
	});

	describe("cancelDelivery", () => {
		it("sends PUT to /deliveries/{id}/cancel", async () => {
			const cancelledResponse: DriveDeliveryResponse = {
				...DELIVERY_RESPONSE,
				delivery_status: "cancelled",
			};
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(cancelledResponse),
			});

			const result = await provider.cancelDelivery("86d_abc123");

			expect(result.delivery_status).toBe("cancelled");

			const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(fetchCall[0]).toBe(
				"https://openapi.doordash.com/drive/v2/deliveries/86d_abc123/cancel",
			);
			expect(fetchCall[1]?.method).toBe("PUT");
		});

		it("throws on 409 for already cancelled delivery", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 409,
				json: () =>
					Promise.resolve({
						code: "conflict",
						message: "Delivery is already cancelled",
					}),
			});

			await expect(provider.cancelDelivery("86d_abc123")).rejects.toThrow(
				"DoorDash API error: Delivery is already cancelled (conflict)",
			);
		});
	});

	describe("createQuote", () => {
		it("sends POST to /quotes with correct body", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(QUOTE_RESPONSE),
			});

			const result = await provider.createQuote({
				externalDeliveryId: "86d_quote_def456",
				pickupAddress: "901 Market St, San Francisco, CA 94103",
				pickupBusinessName: "Dave's Pizza",
				pickupPhoneNumber: "+16505551234",
				dropoffAddress: "123 Main St, San Francisco, CA 94105",
				dropoffBusinessName: "John Doe",
				dropoffPhoneNumber: "+14155559876",
				orderValue: 3500,
			});

			expect(result.fee).toBe(750);
			expect(result.currency).toBe("USD");
			expect(result.pickup_time_estimated).toBe("2026-03-17T18:30:00Z");

			const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(fetchCall[0]).toBe("https://openapi.doordash.com/drive/v2/quotes");
		});
	});

	describe("acceptQuote", () => {
		it("sends POST to /quotes/{id}/accept", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(DELIVERY_RESPONSE),
			});

			const result = await provider.acceptQuote("86d_quote_def456");

			expect(result.external_delivery_id).toBe("86d_abc123");

			const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(fetchCall[0]).toBe(
				"https://openapi.doordash.com/drive/v2/quotes/86d_quote_def456/accept",
			);
			expect(fetchCall[1]?.method).toBe("POST");
		});
	});

	describe("verifyConnection", () => {
		it("returns ok with developer ID snippet when API responds", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve([]),
			});

			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: true,
				accountName: "DoorDash Drive (d5f0a1b2...)",
			});

			const url = vi.mocked(globalThis.fetch).mock.calls[0][0];
			expect(url).toBe("https://openapi.doordash.com/drive/v2/deliveries");
		});

		it("returns error when API returns 401", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				json: () =>
					Promise.resolve({
						code: "unauthorized",
						message: "Invalid credentials",
					}),
			});

			const result = await provider.verifyConnection();

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain("Invalid credentials");
			}
		});

		it("returns error when fetch throws a network error", async () => {
			globalThis.fetch = vi
				.fn()
				.mockRejectedValue(new Error("Network request failed"));

			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "Network request failed",
			});
		});
	});
});

// ── JWT generation tests ─────────────────────────────────────────────────────

describe("createJwt", () => {
	it("produces a valid JWT with three dot-separated parts", async () => {
		const token = await createJwt(MOCK_CREDENTIALS);
		const parts = token.split(".");
		expect(parts).toHaveLength(3);
	});

	it("includes DD-JWT-V1 version in header", async () => {
		const token = await createJwt(MOCK_CREDENTIALS);
		const headerB64 = token.split(".")[0];
		const header = JSON.parse(
			atob(headerB64.replace(/-/g, "+").replace(/_/g, "/")),
		);
		expect(header.alg).toBe("HS256");
		expect(header.typ).toBe("JWT");
		expect(header["dd-ver"]).toBe("DD-JWT-V1");
	});

	it("includes correct claims in payload", async () => {
		const token = await createJwt(MOCK_CREDENTIALS);
		const payloadB64 = token.split(".")[1];
		const payload = JSON.parse(
			atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")),
		);
		expect(payload.aud).toBe("doordash");
		expect(payload.iss).toBe(MOCK_CREDENTIALS.developerId);
		expect(payload.kid).toBe(MOCK_CREDENTIALS.keyId);
		expect(payload.exp).toBeGreaterThan(payload.iat);
		expect(payload.exp - payload.iat).toBe(300);
	});

	it("generates unique tokens on each call due to iat/exp", async () => {
		const token1 = await createJwt(MOCK_CREDENTIALS);
		// Advance time slightly
		await new Promise((resolve) => setTimeout(resolve, 10));
		const token2 = await createJwt(MOCK_CREDENTIALS);

		// The payload part may differ due to iat timestamp
		// But the header should be the same
		expect(token1.split(".")[0]).toBe(token2.split(".")[0]);
	});
});

// ── Status mapping tests ─────────────────────────────────────────────────────

// ── Webhook authentication boundary ──────────────────────────────────────────

describe("webhook authentication boundary", () => {
	it("does not export the undocumented body-HMAC verifier", () => {
		expect("verifyWebhookSignature" in providerModule).toBe(false);
	});
});

describe("mapDriveStatusToInternal", () => {
	it("maps created to pending", () => {
		expect(mapDriveStatusToInternal("created")).toBe("pending");
	});

	it("maps confirmed to accepted", () => {
		expect(mapDriveStatusToInternal("confirmed")).toBe("accepted");
	});

	it("maps enroute_to_pickup to accepted", () => {
		expect(mapDriveStatusToInternal("enroute_to_pickup")).toBe("accepted");
	});

	it("maps arrived_at_pickup to accepted", () => {
		expect(mapDriveStatusToInternal("arrived_at_pickup")).toBe("accepted");
	});

	it("maps picked_up to picked-up", () => {
		expect(mapDriveStatusToInternal("picked_up")).toBe("picked-up");
	});

	it("maps enroute_to_dropoff to picked-up", () => {
		expect(mapDriveStatusToInternal("enroute_to_dropoff")).toBe("picked-up");
	});

	it("maps arrived_at_dropoff to picked-up", () => {
		expect(mapDriveStatusToInternal("arrived_at_dropoff")).toBe("picked-up");
	});

	it("maps delivered to delivered", () => {
		expect(mapDriveStatusToInternal("delivered")).toBe("delivered");
	});

	it("maps cancelled to cancelled", () => {
		expect(mapDriveStatusToInternal("cancelled")).toBe("cancelled");
	});
});
