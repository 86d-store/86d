import { createMockDataService } from "@86d-app/core/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UberDirectController } from "../service";
import { createUberDirectController } from "../service-impl";

// ── Realistic Uber Direct API fixtures ─────────────────────────────────────

const MOCK_TOKEN = {
	access_token: "test_token",
	expires_in: 2592000,
	token_type: "Bearer",
	scope: "eats.deliveries",
};

let quoteCounter = 0;

function mockQuoteResponse() {
	quoteCounter++;
	return {
		kind: "delivery_quote",
		id: `dqt_test_${quoteCounter}`,
		created: new Date().toISOString(),
		expires: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
		fee: 899,
		currency: "USD",
		duration: 25,
		pickup_duration: 10,
	};
}

function mockDeliveryResponse(externalId?: string) {
	return {
		id: `del_${crypto.randomUUID().slice(0, 8)}`,
		status: "pending",
		fee: 899,
		tip: 0,
		tracking_url: "https://uber.com/track/test",
		courier: {
			name: "Alex M.",
			phone_number: "+15551234567",
			vehicle_type: "car",
		},
		dropoff_eta: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
		external_id: externalId,
	};
}

function mockCancelResponse() {
	return { ...mockDeliveryResponse(), status: "canceled" };
}

// ── Fetch mock helpers ──────────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.fn>;

function mockFetchResponse(status: number, body: unknown) {
	fetchSpy.mockResolvedValueOnce({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
		text: async () => JSON.stringify(body),
	});
}

let tokenFetched = false;

/**
 * Mock an API call. Automatically includes a token response
 * on the first call per test (before token is cached).
 */
function mockApiCall(status: number, body: unknown) {
	if (!tokenFetched) {
		mockFetchResponse(200, MOCK_TOKEN);
		tokenFetched = true;
	}
	mockFetchResponse(status, body);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("uber-direct controller", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: UberDirectController;

	beforeEach(() => {
		quoteCounter = 0;
		tokenFetched = false;
		mockData = createMockDataService();
		fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);

		controller = createUberDirectController(mockData, undefined, {
			clientId: "test-client",
			clientSecret: "test-secret",
			customerId: "test-customer",
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// ── requestQuote ────────────────────────────────────────────────

	describe("requestQuote", () => {
		it("creates a quote via Uber Direct API", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
			});
			expect(quote.id).toBeTruthy();
			expect(quote.status).toBe("active");
			expect(quote.fee).toBe(899);
			expect(quote.estimatedMinutes).toBe(25);
		});

		it("sets expiresAt from API response", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});
			expect(quote.expiresAt.getTime()).toBeGreaterThan(Date.now());
		});

		it("persists the quote in data service", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});
			expect(mockData.size("quote")).toBe(1);
			const raw = await mockData.get("quote", quote.id);
			expect(raw).not.toBeNull();
		});

		it("stores pickup and dropoff addresses", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "123 Main", city: "Austin" },
				dropoffAddress: { street: "789 Elm", city: "Dallas" },
			});
			expect(quote.pickupAddress).toEqual({
				street: "123 Main",
				city: "Austin",
			});
			expect(quote.dropoffAddress).toEqual({
				street: "789 Elm",
				city: "Dallas",
			});
		});

		it("generates unique IDs for each quote", async () => {
			mockApiCall(200, mockQuoteResponse());
			mockApiCall(200, mockQuoteResponse());

			const q1 = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});
			const q2 = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});
			expect(q1.id).not.toBe(q2.id);
		});

		it("throws when no credentials are configured", async () => {
			const noCredsController = createUberDirectController(mockData);
			await expect(
				noCredsController.requestQuote({
					pickupAddress: { street: "A" },
					dropoffAddress: { street: "B" },
				}),
			).rejects.toThrow("Uber Direct API credentials are not configured");
		});
	});

	// ── createDelivery ──────────────────────────────────────────────

	describe("createDelivery", () => {
		it("creates a delivery from a valid quote", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});

			mockApiCall(200, mockDeliveryResponse());

			const delivery = await controller.createDelivery({
				orderId: "ord_1",
				quoteId: quote.id,
			});
			expect(delivery).not.toBeNull();
			expect(delivery?.orderId).toBe("ord_1");
			expect(delivery?.status).toBe("pending");
			expect(delivery?.fee).toBe(899);
			expect(delivery?.trackingUrl).toBe("https://uber.com/track/test");
			expect(delivery?.courierName).toBe("Alex M.");
		});

		it("marks the quote as used", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});

			mockApiCall(200, mockDeliveryResponse());

			await controller.createDelivery({
				orderId: "ord_1",
				quoteId: quote.id,
			});
			const updatedQuote = await controller.getQuote(quote.id);
			expect(updatedQuote?.status).toBe("used");
		});

		it("returns null for non-existent quote", async () => {
			const delivery = await controller.createDelivery({
				orderId: "ord_1",
				quoteId: "nonexistent",
			});
			expect(delivery).toBeNull();
		});

		it("returns null for already-used quote", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});

			mockApiCall(200, mockDeliveryResponse());

			await controller.createDelivery({
				orderId: "ord_1",
				quoteId: quote.id,
			});
			const second = await controller.createDelivery({
				orderId: "ord_2",
				quoteId: quote.id,
			});
			expect(second).toBeNull();
		});

		it("sets tip to 0 by default", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});

			mockApiCall(200, mockDeliveryResponse());

			const delivery = await controller.createDelivery({
				orderId: "ord_1",
				quoteId: quote.id,
			});
			expect(delivery?.tip).toBe(0);
		});

		it("accepts custom tip amount", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});

			mockApiCall(200, mockDeliveryResponse());

			const delivery = await controller.createDelivery({
				orderId: "ord_1",
				quoteId: quote.id,
				tip: 500,
			});
			expect(delivery?.tip).toBe(500);
		});

		it("stores pickup and dropoff notes", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});

			mockApiCall(200, mockDeliveryResponse());

			const delivery = await controller.createDelivery({
				orderId: "ord_1",
				quoteId: quote.id,
				pickupNotes: "Ring doorbell",
				dropoffNotes: "Leave at door",
			});
			expect(delivery?.pickupNotes).toBe("Ring doorbell");
			expect(delivery?.dropoffNotes).toBe("Leave at door");
		});
	});

	// ── getDelivery ─────────────────────────────────────────────────

	describe("getDelivery", () => {
		it("returns a delivery by id", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});

			mockApiCall(200, mockDeliveryResponse());

			const created = await controller.createDelivery({
				orderId: "ord_1",
				quoteId: quote.id,
			});

			// Mock the getDelivery API call (token is cached)
			mockFetchResponse(200, {
				...mockDeliveryResponse(),
				status: "pending",
			});

			const delivery = await controller.getDelivery(created?.id as string);
			expect(delivery).not.toBeNull();
			expect(delivery?.orderId).toBe("ord_1");
		});

		it("returns null for non-existent id", async () => {
			const delivery = await controller.getDelivery("nonexistent");
			expect(delivery).toBeNull();
		});
	});

	// ── cancelDelivery ──────────────────────────────────────────────

	describe("cancelDelivery", () => {
		it("cancels a pending delivery", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});

			mockApiCall(200, mockDeliveryResponse());

			const created = await controller.createDelivery({
				orderId: "ord_1",
				quoteId: quote.id,
			});

			// Mock cancel API call
			mockFetchResponse(200, mockCancelResponse());

			const cancelled = await controller.cancelDelivery(created?.id as string);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("returns null for non-existent delivery", async () => {
			const result = await controller.cancelDelivery("nonexistent");
			expect(result).toBeNull();
		});

		it("returns null for already-delivered delivery", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});

			mockApiCall(200, mockDeliveryResponse());

			const created = await controller.createDelivery({
				orderId: "ord_1",
				quoteId: quote.id,
			});
			await controller.updateDeliveryStatus(created?.id as string, "delivered");
			const result = await controller.cancelDelivery(created?.id as string);
			expect(result).toBeNull();
		});

		it("returns null for already-cancelled delivery", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});

			mockApiCall(200, mockDeliveryResponse());

			const created = await controller.createDelivery({
				orderId: "ord_1",
				quoteId: quote.id,
			});

			mockFetchResponse(200, mockCancelResponse());

			await controller.cancelDelivery(created?.id as string);
			const result = await controller.cancelDelivery(created?.id as string);
			expect(result).toBeNull();
		});
	});

	// ── updateDeliveryStatus ────────────────────────────────────────

	describe("updateDeliveryStatus", () => {
		it("updates status to accepted", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});

			mockApiCall(200, mockDeliveryResponse());

			const created = await controller.createDelivery({
				orderId: "ord_1",
				quoteId: quote.id,
			});
			const updated = await controller.updateDeliveryStatus(
				created?.id as string,
				"accepted",
			);
			expect(updated?.status).toBe("accepted");
		});

		it("returns null for non-existent delivery", async () => {
			const result = await controller.updateDeliveryStatus(
				"nonexistent",
				"accepted",
			);
			expect(result).toBeNull();
		});

		it("updates courier info along with status", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});

			mockApiCall(200, mockDeliveryResponse());

			const created = await controller.createDelivery({
				orderId: "ord_1",
				quoteId: quote.id,
			});
			const updated = await controller.updateDeliveryStatus(
				created?.id as string,
				"picked-up",
				{
					courierName: "John",
					courierPhone: "555-1234",
					courierVehicle: "Sedan",
					trackingUrl: "https://track.uber.com/123",
				},
			);
			expect(updated?.courierName).toBe("John");
			expect(updated?.courierPhone).toBe("555-1234");
			expect(updated?.courierVehicle).toBe("Sedan");
			expect(updated?.trackingUrl).toBe("https://track.uber.com/123");
		});

		it("updates updatedAt timestamp", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});

			mockApiCall(200, mockDeliveryResponse());

			const created = await controller.createDelivery({
				orderId: "ord_1",
				quoteId: quote.id,
			});
			const original = created?.updatedAt.getTime() ?? 0;
			const updated = await controller.updateDeliveryStatus(
				created?.id as string,
				"accepted",
			);
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(original);
		});
	});

	// ── listDeliveries ──────────────────────────────────────────────

	describe("listDeliveries", () => {
		it("returns empty array when no deliveries exist", async () => {
			const deliveries = await controller.listDeliveries();
			expect(deliveries).toHaveLength(0);
		});

		it("returns all deliveries", async () => {
			mockApiCall(200, mockQuoteResponse());
			const q1 = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});
			mockApiCall(200, mockQuoteResponse());
			const q2 = await controller.requestQuote({
				pickupAddress: { street: "C" },
				dropoffAddress: { street: "D" },
			});

			mockApiCall(200, mockDeliveryResponse());
			await controller.createDelivery({
				orderId: "ord_1",
				quoteId: q1.id,
			});
			mockApiCall(200, mockDeliveryResponse());
			await controller.createDelivery({
				orderId: "ord_2",
				quoteId: q2.id,
			});
			const deliveries = await controller.listDeliveries();
			expect(deliveries).toHaveLength(2);
		});

		it("filters by status", async () => {
			mockApiCall(200, mockQuoteResponse());
			const q1 = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});
			mockApiCall(200, mockQuoteResponse());
			const q2 = await controller.requestQuote({
				pickupAddress: { street: "C" },
				dropoffAddress: { street: "D" },
			});

			mockApiCall(200, mockDeliveryResponse());
			const d1 = await controller.createDelivery({
				orderId: "ord_1",
				quoteId: q1.id,
			});
			mockApiCall(200, mockDeliveryResponse());
			await controller.createDelivery({
				orderId: "ord_2",
				quoteId: q2.id,
			});
			await controller.updateDeliveryStatus(d1?.id as string, "delivered");
			const delivered = await controller.listDeliveries({
				status: "delivered",
			});
			expect(delivered).toHaveLength(1);
			expect(delivered[0].status).toBe("delivered");
		});

		it("filters by orderId", async () => {
			mockApiCall(200, mockQuoteResponse());
			const q1 = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});
			mockApiCall(200, mockQuoteResponse());
			const q2 = await controller.requestQuote({
				pickupAddress: { street: "C" },
				dropoffAddress: { street: "D" },
			});

			mockApiCall(200, mockDeliveryResponse());
			await controller.createDelivery({
				orderId: "ord_1",
				quoteId: q1.id,
			});
			mockApiCall(200, mockDeliveryResponse());
			await controller.createDelivery({
				orderId: "ord_2",
				quoteId: q2.id,
			});
			const results = await controller.listDeliveries({
				orderId: "ord_1",
			});
			expect(results).toHaveLength(1);
			expect(results[0].orderId).toBe("ord_1");
		});

		it("respects take and skip", async () => {
			mockApiCall(200, mockQuoteResponse());
			const q1 = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});
			mockApiCall(200, mockQuoteResponse());
			const q2 = await controller.requestQuote({
				pickupAddress: { street: "C" },
				dropoffAddress: { street: "D" },
			});

			mockApiCall(200, mockDeliveryResponse());
			await controller.createDelivery({
				orderId: "ord_1",
				quoteId: q1.id,
			});
			mockApiCall(200, mockDeliveryResponse());
			await controller.createDelivery({
				orderId: "ord_2",
				quoteId: q2.id,
			});
			const page = await controller.listDeliveries({ take: 1 });
			expect(page).toHaveLength(1);

			const skipped = await controller.listDeliveries({ skip: 10 });
			expect(skipped).toHaveLength(0);
		});
	});

	// ── getQuote / listQuotes ───────────────────────────────────────

	describe("getQuote", () => {
		it("returns a quote by id", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});
			const found = await controller.getQuote(quote.id);
			expect(found).not.toBeNull();
			expect(found?.id).toBe(quote.id);
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getQuote("nonexistent");
			expect(found).toBeNull();
		});
	});

	describe("listQuotes", () => {
		it("returns all quotes", async () => {
			mockApiCall(200, mockQuoteResponse());
			await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});
			mockApiCall(200, mockQuoteResponse());
			await controller.requestQuote({
				pickupAddress: { street: "C" },
				dropoffAddress: { street: "D" },
			});
			const quotes = await controller.listQuotes();
			expect(quotes).toHaveLength(2);
		});

		it("filters by status", async () => {
			mockApiCall(200, mockQuoteResponse());
			const q = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});
			mockApiCall(200, mockQuoteResponse());
			await controller.requestQuote({
				pickupAddress: { street: "C" },
				dropoffAddress: { street: "D" },
			});

			mockApiCall(200, mockDeliveryResponse());
			await controller.createDelivery({
				orderId: "ord_1",
				quoteId: q.id,
			});
			const active = await controller.listQuotes({ status: "active" });
			expect(active).toHaveLength(1);
			const used = await controller.listQuotes({ status: "used" });
			expect(used).toHaveLength(1);
		});
	});

	// ── getDeliveryStats ────────────────────────────────────────────

	describe("getDeliveryStats", () => {
		it("returns zeroes when no deliveries exist", async () => {
			const stats = await controller.getDeliveryStats();
			expect(stats.totalDeliveries).toBe(0);
			expect(stats.totalFees).toBe(0);
			expect(stats.totalTips).toBe(0);
		});

		it("aggregates delivery stats correctly", async () => {
			mockApiCall(200, mockQuoteResponse());
			const q1 = await controller.requestQuote({
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
			});
			mockApiCall(200, mockQuoteResponse());
			const q2 = await controller.requestQuote({
				pickupAddress: { street: "C" },
				dropoffAddress: { street: "D" },
			});
			mockApiCall(200, mockQuoteResponse());
			const q3 = await controller.requestQuote({
				pickupAddress: { street: "E" },
				dropoffAddress: { street: "F" },
			});

			mockApiCall(200, mockDeliveryResponse());
			const d1 = await controller.createDelivery({
				orderId: "ord_1",
				quoteId: q1.id,
				tip: 200,
			});
			mockApiCall(200, mockDeliveryResponse());
			const d2 = await controller.createDelivery({
				orderId: "ord_2",
				quoteId: q2.id,
				tip: 300,
			});
			mockApiCall(200, mockDeliveryResponse());
			await controller.createDelivery({
				orderId: "ord_3",
				quoteId: q3.id,
			});

			await controller.updateDeliveryStatus(d1?.id as string, "delivered");

			mockFetchResponse(200, mockCancelResponse());
			await controller.cancelDelivery(d2?.id as string);

			const stats = await controller.getDeliveryStats();
			expect(stats.totalDeliveries).toBe(3);
			expect(stats.totalDelivered).toBe(1);
			expect(stats.totalCancelled).toBe(1);
			expect(stats.totalPending).toBe(1);
			expect(stats.totalTips).toBe(500);
			expect(stats.totalFees).toBeGreaterThan(0);
		});
	});

	// ── full lifecycle ──────────────────────────────────────────────

	describe("full lifecycle", () => {
		it("quote -> delivery -> picked-up -> delivered", async () => {
			mockApiCall(200, mockQuoteResponse());

			const quote = await controller.requestQuote({
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
			});
			expect(quote.status).toBe("active");

			mockApiCall(200, mockDeliveryResponse());

			const delivery = await controller.createDelivery({
				orderId: "ord_lifecycle",
				quoteId: quote.id,
				tip: 400,
			});
			expect(delivery?.status).toBe("pending");

			const accepted = await controller.updateDeliveryStatus(
				delivery?.id as string,
				"accepted",
				{ externalId: "uber_ext_123" },
			);
			expect(accepted?.status).toBe("accepted");
			expect(accepted?.externalId).toBe("uber_ext_123");

			const pickedUp = await controller.updateDeliveryStatus(
				delivery?.id as string,
				"picked-up",
				{
					courierName: "Jane",
					courierPhone: "555-9876",
					actualPickupTime: new Date(),
				},
			);
			expect(pickedUp?.status).toBe("picked-up");
			expect(pickedUp?.courierName).toBe("Jane");

			const delivered = await controller.updateDeliveryStatus(
				delivery?.id as string,
				"delivered",
				{ actualDeliveryTime: new Date() },
			);
			expect(delivered?.status).toBe("delivered");
			expect(delivered?.actualDeliveryTime).toBeDefined();

			// Quote is used
			const usedQuote = await controller.getQuote(quote.id);
			expect(usedQuote?.status).toBe("used");
		});
	});
});
