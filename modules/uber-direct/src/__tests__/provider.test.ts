import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	mapUberStatusToInternal,
	UberDirectProvider,
	verifyWebhookSignature,
} from "../provider";

// ── Realistic API response fixtures ────────────────────────────────────────

const MOCK_TOKEN_RESPONSE = {
	access_token: "ey_test_token_abc123",
	expires_in: 2592000,
	token_type: "Bearer",
	scope: "eats.deliveries",
};

const MOCK_QUOTE_RESPONSE = {
	kind: "delivery_quote",
	id: "dqt_abc123def456",
	created: "2026-03-17T08:00:00.000Z",
	expires: "2026-03-17T08:30:00.000Z",
	fee: 899,
	currency: "USD",
	currency_type: "USD",
	dropoff_eta: "2026-03-17T08:45:00.000Z",
	duration: 25,
	pickup_duration: 10,
	dropoff_deadline: "2026-03-17T09:00:00.000Z",
};

const MOCK_DELIVERY_RESPONSE = {
	id: "del_xyz789",
	quote_id: "dqt_abc123def456",
	complete: false,
	courier: {
		name: "Alex M.",
		rating: 4.9,
		vehicle_type: "car",
		phone_number: "+15551234567",
		location: { lat: 37.7749, lng: -122.4194 },
		img_href: "https://img.uber.com/courier/abc123",
	},
	courier_imminent: false,
	created: "2026-03-17T08:05:00.000Z",
	currency: "USD",
	dropoff: {
		name: "Jane Smith",
		phone_number: "+15559876543",
		address: "456 Oak Ave, San Francisco, CA 94102",
		location: { lat: 37.7851, lng: -122.4089 },
		notes: "Leave at door",
	},
	dropoff_deadline: "2026-03-17T09:00:00.000Z",
	dropoff_eta: "2026-03-17T08:45:00.000Z",
	external_id: "86d_order_123",
	fee: 899,
	kind: "delivery",
	live_mode: false,
	manifest: {
		reference: "Order #123",
		description: "Food delivery",
		total_value: 2500,
	},
	pickup: {
		name: "Test Store",
		phone_number: "+15551112222",
		address: "123 Main St, San Francisco, CA 94105",
		location: { lat: 37.7749, lng: -122.4194 },
	},
	pickup_deadline: "2026-03-17T08:30:00.000Z",
	pickup_eta: "2026-03-17T08:15:00.000Z",
	pickup_ready: "2026-03-17T08:05:00.000Z",
	status: "pending",
	tip: 200,
	tracking_url: "https://uber.com/track/del_xyz789",
	updated: "2026-03-17T08:05:00.000Z",
	uuid: "uuid-del-xyz789",
};

const MOCK_LIST_RESPONSE = {
	data: [MOCK_DELIVERY_RESPONSE],
	next_href: null,
	total_count: 1,
};

const MOCK_CANCEL_RESPONSE = {
	...MOCK_DELIVERY_RESPONSE,
	status: "canceled",
	complete: true,
};

const MOCK_ERROR_RESPONSE = {
	code: "invalid_params",
	message: "The pickup address is invalid.",
	kind: "error",
};

// ── Test helpers ────────────────────────────────────────────────────────────

const TEST_CREDENTIALS = {
	clientId: "test-client-id",
	clientSecret: "test-client-secret",
	customerId: "test-customer-id",
};

let fetchSpy: ReturnType<typeof vi.fn>;

function mockFetchResponse(status: number, body: unknown) {
	fetchSpy.mockResolvedValueOnce({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
		text: async () => JSON.stringify(body),
	});
}

/** Mock token + API call sequence */
function mockTokenThenApi(status: number, body: unknown) {
	mockFetchResponse(200, MOCK_TOKEN_RESPONSE);
	mockFetchResponse(status, body);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("UberDirectProvider", () => {
	beforeEach(() => {
		fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// ── Authentication ──────────────────────────────────────────────

	describe("getAccessToken", () => {
		it("fetches a new OAuth token with client credentials", async () => {
			mockFetchResponse(200, MOCK_TOKEN_RESPONSE);
			const provider = new UberDirectProvider(TEST_CREDENTIALS);
			const token = await provider.getAccessToken();

			expect(token).toBe("ey_test_token_abc123");
			expect(fetchSpy).toHaveBeenCalledWith(
				"https://auth.uber.com/oauth/v2/token",
				expect.objectContaining({
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
				}),
			);

			// Verify the body contains correct params
			const call = fetchSpy.mock.calls[0];
			const body = call[1].body as string;
			expect(body).toContain("client_id=test-client-id");
			expect(body).toContain("client_secret=test-client-secret");
			expect(body).toContain("grant_type=client_credentials");
			expect(body).toContain("scope=eats.deliveries");
		});

		it("caches the token for subsequent calls", async () => {
			mockFetchResponse(200, MOCK_TOKEN_RESPONSE);
			const provider = new UberDirectProvider(TEST_CREDENTIALS);

			const token1 = await provider.getAccessToken();
			const token2 = await provider.getAccessToken();

			expect(token1).toBe(token2);
			expect(fetchSpy).toHaveBeenCalledTimes(1);
		});

		it("throws on OAuth failure", async () => {
			mockFetchResponse(401, { error: "invalid_client" });
			const provider = new UberDirectProvider(TEST_CREDENTIALS);

			await expect(provider.getAccessToken()).rejects.toThrow(
				"Uber OAuth error",
			);
		});
	});

	// ── Create Quote ────────────────────────────────────────────────

	describe("createQuote", () => {
		it("sends correct request and returns quote", async () => {
			mockTokenThenApi(200, MOCK_QUOTE_RESPONSE);
			const provider = new UberDirectProvider(TEST_CREDENTIALS);

			const quote = await provider.createQuote({
				pickup_address: "123 Main St, San Francisco, CA",
				dropoff_address: "456 Oak Ave, San Francisco, CA",
			});

			expect(quote.id).toBe("dqt_abc123def456");
			expect(quote.fee).toBe(899);
			expect(quote.duration).toBe(25);
			expect(quote.currency).toBe("USD");

			// Verify API call
			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toBe(
				"https://api.uber.com/v1/customers/test-customer-id/delivery_quotes",
			);
			expect(apiCall[1].method).toBe("POST");
			expect(apiCall[1].headers.Authorization).toBe(
				"Bearer ey_test_token_abc123",
			);
		});

		it("includes optional parameters in the request", async () => {
			mockTokenThenApi(200, MOCK_QUOTE_RESPONSE);
			const provider = new UberDirectProvider(TEST_CREDENTIALS);

			await provider.createQuote({
				pickup_address: "123 Main St",
				dropoff_address: "456 Oak Ave",
				pickup_latitude: 37.7749,
				pickup_longitude: -122.4194,
				manifest_total_value: 2500,
			});

			const apiCall = fetchSpy.mock.calls[1];
			const body = JSON.parse(apiCall[1].body) as Record<string, unknown>;
			expect(body.pickup_latitude).toBe(37.7749);
			expect(body.manifest_total_value).toBe(2500);
		});

		it("throws on API error", async () => {
			mockTokenThenApi(400, MOCK_ERROR_RESPONSE);
			const provider = new UberDirectProvider(TEST_CREDENTIALS);

			await expect(
				provider.createQuote({
					pickup_address: "invalid",
					dropoff_address: "also invalid",
				}),
			).rejects.toThrow("The pickup address is invalid");
		});
	});

	// ── Create Delivery ─────────────────────────────────────────────

	describe("createDelivery", () => {
		it("sends correct request and returns delivery", async () => {
			mockTokenThenApi(200, MOCK_DELIVERY_RESPONSE);
			const provider = new UberDirectProvider(TEST_CREDENTIALS);

			const delivery = await provider.createDelivery({
				pickup_name: "Test Store",
				pickup_address: "123 Main St, San Francisco, CA",
				pickup_phone_number: "+15551112222",
				dropoff_name: "Jane Smith",
				dropoff_address: "456 Oak Ave, San Francisco, CA",
				dropoff_phone_number: "+15559876543",
				manifest_items: [
					{ name: "Cheeseburger", quantity: 2, size: "medium", price: 1250 },
				],
				tip: 200,
				quote_id: "dqt_abc123def456",
			});

			expect(delivery.id).toBe("del_xyz789");
			expect(delivery.status).toBe("pending");
			expect(delivery.fee).toBe(899);
			expect(delivery.tip).toBe(200);
			expect(delivery.tracking_url).toBe("https://uber.com/track/del_xyz789");
			expect(delivery.courier?.name).toBe("Alex M.");
			expect(delivery.courier?.vehicle_type).toBe("car");

			// Verify API call
			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toBe(
				"https://api.uber.com/v1/customers/test-customer-id/deliveries",
			);
			expect(apiCall[1].method).toBe("POST");
			const body = JSON.parse(apiCall[1].body) as Record<string, unknown>;
			expect(body.pickup_name).toBe("Test Store");
			expect(body.dropoff_name).toBe("Jane Smith");
			expect(body.quote_id).toBe("dqt_abc123def456");
		});

		it("throws on API error", async () => {
			mockTokenThenApi(400, MOCK_ERROR_RESPONSE);
			const provider = new UberDirectProvider(TEST_CREDENTIALS);

			await expect(
				provider.createDelivery({
					pickup_name: "Store",
					pickup_address: "bad",
					pickup_phone_number: "+1",
					dropoff_name: "Customer",
					dropoff_address: "bad",
					dropoff_phone_number: "+1",
					manifest_items: [],
				}),
			).rejects.toThrow("Uber Direct API error");
		});
	});

	// ── Get Delivery ────────────────────────────────────────────────

	describe("getDelivery", () => {
		it("fetches delivery by ID", async () => {
			mockTokenThenApi(200, MOCK_DELIVERY_RESPONSE);
			const provider = new UberDirectProvider(TEST_CREDENTIALS);

			const delivery = await provider.getDelivery("del_xyz789");

			expect(delivery.id).toBe("del_xyz789");
			expect(delivery.status).toBe("pending");

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toBe(
				"https://api.uber.com/v1/customers/test-customer-id/deliveries/del_xyz789",
			);
			expect(apiCall[1].method).toBe("GET");
		});

		it("encodes delivery ID in URL", async () => {
			mockTokenThenApi(200, MOCK_DELIVERY_RESPONSE);
			const provider = new UberDirectProvider(TEST_CREDENTIALS);

			await provider.getDelivery("del/with spaces");

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toContain("del%2Fwith%20spaces");
		});
	});

	// ── Cancel Delivery ─────────────────────────────────────────────

	describe("cancelDelivery", () => {
		it("cancels delivery by ID", async () => {
			mockTokenThenApi(200, MOCK_CANCEL_RESPONSE);
			const provider = new UberDirectProvider(TEST_CREDENTIALS);

			const result = await provider.cancelDelivery("del_xyz789");

			expect(result.status).toBe("canceled");
			expect(result.complete).toBe(true);

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toBe(
				"https://api.uber.com/v1/customers/test-customer-id/deliveries/del_xyz789/cancel",
			);
			expect(apiCall[1].method).toBe("POST");
		});
	});

	// ── List Deliveries ─────────────────────────────────────────────

	describe("listDeliveries", () => {
		it("lists deliveries without filters", async () => {
			mockTokenThenApi(200, MOCK_LIST_RESPONSE);
			const provider = new UberDirectProvider(TEST_CREDENTIALS);

			const result = await provider.listDeliveries();

			expect(result.data).toHaveLength(1);
			expect(result.total_count).toBe(1);

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toBe(
				"https://api.uber.com/v1/customers/test-customer-id/deliveries",
			);
		});

		it("passes filter and limit as query params", async () => {
			mockTokenThenApi(200, MOCK_LIST_RESPONSE);
			const provider = new UberDirectProvider(TEST_CREDENTIALS);

			await provider.listDeliveries({
				filter: "status=pending",
				limit: 10,
			});

			const apiCall = fetchSpy.mock.calls[1];
			const url = apiCall[0] as string;
			expect(url).toContain("filter=status%3Dpending");
			expect(url).toContain("limit=10");
		});
	});

	describe("verifyConnection", () => {
		it("returns ok when OAuth token is obtained successfully", async () => {
			mockFetchResponse(200, MOCK_TOKEN_RESPONSE);

			const provider = new UberDirectProvider(TEST_CREDENTIALS);
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: true,
				accountName: "Uber Direct (test-cus...)",
			});
		});

		it("returns error when OAuth token request fails", async () => {
			mockFetchResponse(401, "Unauthorized");

			const provider = new UberDirectProvider(TEST_CREDENTIALS);
			const result = await provider.verifyConnection();

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain("Uber OAuth error");
			}
		});

		it("returns error on network failure", async () => {
			fetchSpy.mockRejectedValueOnce(new Error("Network request failed"));

			const provider = new UberDirectProvider(TEST_CREDENTIALS);
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "Network request failed",
			});
		});
	});
});

// ── Status mapping ──────────────────────────────────────────────────────────

describe("mapUberStatusToInternal", () => {
	it("maps pending to pending", () => {
		expect(mapUberStatusToInternal("pending")).toBe("pending");
	});

	it("maps pickup to accepted", () => {
		expect(mapUberStatusToInternal("pickup")).toBe("accepted");
	});

	it("maps pickup_complete to picked-up", () => {
		expect(mapUberStatusToInternal("pickup_complete")).toBe("picked-up");
	});

	it("maps dropoff to picked-up", () => {
		expect(mapUberStatusToInternal("dropoff")).toBe("picked-up");
	});

	it("maps delivered to delivered", () => {
		expect(mapUberStatusToInternal("delivered")).toBe("delivered");
	});

	it("maps canceled to cancelled", () => {
		expect(mapUberStatusToInternal("canceled")).toBe("cancelled");
	});

	it("maps returned to failed", () => {
		expect(mapUberStatusToInternal("returned")).toBe("failed");
	});

	it("defaults unknown status to pending", () => {
		expect(mapUberStatusToInternal("unknown_status" as "pending")).toBe(
			"pending",
		);
	});
});

// ── Webhook signature verification ──────────────────────────────────────────

describe("verifyWebhookSignature", () => {
	it("returns true for valid signature", async () => {
		const payload = '{"kind":"event.delivery_status","id":"del_123"}';
		const key = "test-signing-key";

		// Compute expected signature
		const enc = new TextEncoder();
		const cryptoKey = await crypto.subtle.importKey(
			"raw",
			enc.encode(key),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sig = await crypto.subtle.sign(
			"HMAC",
			cryptoKey,
			enc.encode(payload),
		);
		const expectedHex = Array.from(new Uint8Array(sig))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		const result = await verifyWebhookSignature(payload, expectedHex, key);
		expect(result).toBe(true);
	});

	it("returns false for invalid signature", async () => {
		const result = await verifyWebhookSignature(
			'{"kind":"event.delivery_status"}',
			"invalid_signature_hex",
			"test-key",
		);
		expect(result).toBe(false);
	});

	it("returns false for tampered payload", async () => {
		const originalPayload = '{"kind":"event.delivery_status","id":"del_123"}';
		const key = "test-signing-key";

		const enc = new TextEncoder();
		const cryptoKey = await crypto.subtle.importKey(
			"raw",
			enc.encode(key),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sig = await crypto.subtle.sign(
			"HMAC",
			cryptoKey,
			enc.encode(originalPayload),
		);
		const signatureHex = Array.from(new Uint8Array(sig))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		// Tamper with payload
		const tamperedPayload =
			'{"kind":"event.delivery_status","id":"del_hacked"}';
		const result = await verifyWebhookSignature(
			tamperedPayload,
			signatureHex,
			key,
		);
		expect(result).toBe(false);
	});
});
