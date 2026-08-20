import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UberDeliveryResponse, UberQuoteResponse } from "../provider";
import { createUberDirectController } from "../service-impl";

// ── Provider mock ──────────────────────────────────────────────────────────

const mockProvider = {
	createQuote: vi.fn<() => Promise<UberQuoteResponse>>(),
	createDelivery: vi.fn<() => Promise<UberDeliveryResponse>>(),
	getDelivery: vi.fn<() => Promise<UberDeliveryResponse>>(),
	cancelDelivery: vi.fn<() => Promise<void>>(),
};

vi.mock("../provider", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../provider")>();

	function MockUberDirectProvider() {
		return mockProvider;
	}

	return {
		...actual,
		UberDirectProvider: MockUberDirectProvider,
	};
});

function makeUberDeliveryResponse(
	overrides: Partial<UberDeliveryResponse> = {},
): UberDeliveryResponse {
	return {
		id: "uber-del-1",
		status: "pending",
		fee: 699,
		tip: 0,
		tracking_url: "https://track.uber.com/abc",
		courier: undefined,
		dropoff_eta: undefined,
		created: "2026-03-27T12:00:00Z",
		updated: "2026-03-27T12:00:00Z",
		...overrides,
	};
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("uber-direct service-impl with provider", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createUberDirectController>;

	beforeEach(() => {
		mockData = createMockDataService();
		vi.clearAllMocks();

		controller = createUberDirectController(mockData, undefined, {
			clientId: "client-123",
			clientSecret: "secret-456",
			customerId: "customer-789",
		});
	});

	// ── requestQuote ─────────────────────────────────────────────────

	describe("requestQuote", () => {
		it("returns a quote with fee and estimated minutes from API", async () => {
			mockProvider.createQuote.mockResolvedValue({
				id: "uber-quote-1",
				fee: 599,
				duration: 25,
				expires: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
			});

			const quote = await controller.requestQuote({
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
			});

			expect(quote.fee).toBe(599);
			expect(quote.estimatedMinutes).toBe(25);
			expect(quote.status).toBe("active");
		});

		it("persists the quote to data store", async () => {
			mockProvider.createQuote.mockResolvedValue({
				id: "uber-quote-2",
				fee: 499,
				duration: 20,
			});

			const quote = await controller.requestQuote({
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
			});

			expect(mockData.size("quote")).toBe(1);
			const stored = await mockData.get("quote", quote.id);
			expect(stored).not.toBeNull();
		});

		it("defaults to 30 minutes when API returns no duration", async () => {
			mockProvider.createQuote.mockResolvedValue({
				id: "uber-quote-3",
				fee: 499,
			});

			const quote = await controller.requestQuote({
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
			});

			expect(quote.estimatedMinutes).toBe(30);
		});

		it("defaults to 0 fee when API returns no fee", async () => {
			mockProvider.createQuote.mockResolvedValue({
				id: "uber-quote-4",
			});

			const quote = await controller.requestQuote({
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
			});

			expect(quote.fee).toBe(0);
		});

		it("defaults to 15-minute expiration when API returns no expiry", async () => {
			mockProvider.createQuote.mockResolvedValue({
				id: "uber-quote-5",
				fee: 699,
				duration: 25,
			});

			const before = Date.now();
			const quote = await controller.requestQuote({
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
			});

			const expectedExpiry = before + 15 * 60 * 1000;
			expect(quote.expiresAt.getTime()).toBeGreaterThanOrEqual(
				expectedExpiry - 1000,
			);
			expect(quote.expiresAt.getTime()).toBeLessThanOrEqual(
				expectedExpiry + 1000,
			);
		});

		it("throws when no credentials are configured", async () => {
			const noCredCtrl = createUberDirectController(mockData);

			await expect(
				noCredCtrl.requestQuote({
					pickupAddress: { street: "123 Main St" },
					dropoffAddress: { street: "456 Oak Ave" },
				}),
			).rejects.toThrow("Uber Direct API credentials are not configured");
		});

		it("extracts structured address parts when street is not available", async () => {
			mockProvider.createQuote.mockResolvedValue({
				id: "uber-quote-6",
				fee: 499,
				duration: 20,
			});

			await controller.requestQuote({
				pickupAddress: {
					street_address_1: "100 Broadway",
					city: "New York",
					state: "NY",
					zip_code: "10001",
				},
				dropoffAddress: { street: "456 Oak Ave" },
			});

			expect(mockProvider.createQuote).toHaveBeenCalledWith(
				expect.objectContaining({
					pickup_address: "100 Broadway, New York, NY, 10001",
				}),
			);
		});
	});

	// ── createDelivery ───────────────────────────────────────────────

	describe("createDelivery", () => {
		async function setupQuote(): Promise<string> {
			mockProvider.createQuote.mockResolvedValue({
				id: "uber-quote-setup",
				fee: 599,
				duration: 25,
				expires: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
			});

			const quote = await controller.requestQuote({
				pickupAddress: {
					street: "123 Main St",
					name: "My Store",
					phone: "+15551111111",
				},
				dropoffAddress: {
					street: "456 Oak Ave",
					name: "Customer",
					phone: "+15552222222",
				},
			});
			return quote.id;
		}

		it("creates a delivery from a valid quote", async () => {
			const quoteId = await setupQuote();
			mockProvider.createDelivery.mockResolvedValue(
				makeUberDeliveryResponse({
					tracking_url: "https://track.uber.com/del-1",
					fee: 599,
				}),
			);

			const delivery = await controller.createDelivery({
				orderId: "order-1",
				quoteId,
			});

			expect(delivery).not.toBeNull();
			expect(delivery?.status).toBe("pending");
			expect(delivery?.trackingUrl).toBe("https://track.uber.com/del-1");
			expect(delivery?.orderId).toBe("order-1");
		});

		it("marks the quote as used after creating delivery", async () => {
			const quoteId = await setupQuote();
			mockProvider.createDelivery.mockResolvedValue(makeUberDeliveryResponse());

			await controller.createDelivery({
				orderId: "order-2",
				quoteId,
			});

			const usedQuote = await controller.getQuote(quoteId);
			expect(usedQuote?.status).toBe("used");
		});

		it("returns null for non-existent quote", async () => {
			const result = await controller.createDelivery({
				orderId: "order-3",
				quoteId: "non-existent",
			});
			expect(result).toBeNull();
		});

		it("returns null for expired quote", async () => {
			// Manually insert an expired quote
			const expiredQuote = {
				id: "expired-q",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 599,
				estimatedMinutes: 25,
				expiresAt: new Date(Date.now() - 60_000), // 1 minute ago
				status: "active",
				createdAt: new Date(),
			};
			await mockData.upsert(
				"quote",
				expiredQuote.id,
				expiredQuote as unknown as Record<string, unknown>,
			);

			const result = await controller.createDelivery({
				orderId: "order-4",
				quoteId: "expired-q",
			});
			expect(result).toBeNull();
		});

		it("returns null for already-used quote", async () => {
			const usedQuote = {
				id: "used-q",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 599,
				estimatedMinutes: 25,
				expiresAt: new Date(Date.now() + 15 * 60 * 1000),
				status: "used",
				createdAt: new Date(),
			};
			await mockData.upsert(
				"quote",
				usedQuote.id,
				usedQuote as unknown as Record<string, unknown>,
			);

			const result = await controller.createDelivery({
				orderId: "order-5",
				quoteId: "used-q",
			});
			expect(result).toBeNull();
		});

		it("sets courier info from API response", async () => {
			const quoteId = await setupQuote();
			mockProvider.createDelivery.mockResolvedValue(
				makeUberDeliveryResponse({
					courier: {
						name: "Alex R.",
						phone_number: "+15559999999",
						vehicle_type: "bicycle",
					},
				}),
			);

			const delivery = await controller.createDelivery({
				orderId: "order-6",
				quoteId,
			});

			expect(delivery?.courierName).toBe("Alex R.");
			expect(delivery?.courierPhone).toBe("+15559999999");
			expect(delivery?.courierVehicle).toBe("bicycle");
		});

		it("sets estimated delivery time from dropoff_eta", async () => {
			const quoteId = await setupQuote();
			mockProvider.createDelivery.mockResolvedValue(
				makeUberDeliveryResponse({
					dropoff_eta: "2026-03-27T14:30:00Z",
				}),
			);

			const delivery = await controller.createDelivery({
				orderId: "order-7",
				quoteId,
			});

			expect(delivery?.estimatedDeliveryTime).toBeInstanceOf(Date);
		});

		it("passes tip to provider", async () => {
			const quoteId = await setupQuote();
			mockProvider.createDelivery.mockResolvedValue(makeUberDeliveryResponse());

			await controller.createDelivery({
				orderId: "order-8",
				quoteId,
				tip: 300,
			});

			expect(mockProvider.createDelivery).toHaveBeenCalledWith(
				expect.objectContaining({ tip: 300 }),
			);
		});
	});

	// ── getDelivery with status refresh ──────────────────────────────

	describe("getDelivery with provider refresh", () => {
		async function createTestDelivery(): Promise<string> {
			mockProvider.createQuote.mockResolvedValue({
				id: "uber-quote-x",
				fee: 599,
				duration: 25,
				expires: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
			});
			const quote = await controller.requestQuote({
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
			});

			mockProvider.createDelivery.mockResolvedValue(
				makeUberDeliveryResponse({ id: "uber-ext-1" }),
			);
			const delivery = await controller.createDelivery({
				orderId: "order-refresh",
				quoteId: quote.id,
			});
			if (!delivery) throw new Error("expected delivery");
			return delivery.id;
		}

		it("refreshes status from Uber Direct API", async () => {
			const deliveryId = await createTestDelivery();

			mockProvider.getDelivery.mockResolvedValue(
				makeUberDeliveryResponse({
					status: "pickup_complete",
					courier: {
						name: "Bob M.",
						phone_number: "+15553333333",
						vehicle_type: "car",
					},
				}),
			);

			const refreshed = await controller.getDelivery(deliveryId);
			expect(refreshed?.status).toBe("picked-up");
			expect(refreshed?.courierName).toBe("Bob M.");
			expect(refreshed?.actualPickupTime).toBeInstanceOf(Date);
		});

		it("sets actualDeliveryTime when status becomes delivered", async () => {
			const deliveryId = await createTestDelivery();

			mockProvider.getDelivery.mockResolvedValue(
				makeUberDeliveryResponse({ status: "delivered" }),
			);

			const refreshed = await controller.getDelivery(deliveryId);
			expect(refreshed?.status).toBe("delivered");
			expect(refreshed?.actualDeliveryTime).toBeInstanceOf(Date);
		});

		it("falls back to local data when API call fails", async () => {
			const deliveryId = await createTestDelivery();

			mockProvider.getDelivery.mockRejectedValue(new Error("API timeout"));

			const result = await controller.getDelivery(deliveryId);
			expect(result).not.toBeNull();
			expect(result?.status).toBe("pending");
		});

		it("returns null for non-existent delivery", async () => {
			const result = await controller.getDelivery("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── cancelDelivery with provider ─────────────────────────────────

	describe("cancelDelivery with provider", () => {
		async function createTestDelivery(): Promise<string> {
			mockProvider.createQuote.mockResolvedValue({
				id: "uber-quote-cancel",
				fee: 599,
				duration: 25,
				expires: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
			});
			const quote = await controller.requestQuote({
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
			});

			mockProvider.createDelivery.mockResolvedValue(
				makeUberDeliveryResponse({ id: "uber-ext-cancel" }),
			);
			const delivery = await controller.createDelivery({
				orderId: "order-cancel",
				quoteId: quote.id,
			});
			if (!delivery) throw new Error("expected delivery");
			return delivery.id;
		}

		it("calls provider.cancelDelivery and sets status", async () => {
			const deliveryId = await createTestDelivery();
			mockProvider.cancelDelivery.mockResolvedValue(undefined);

			const cancelled = await controller.cancelDelivery(deliveryId);
			expect(cancelled?.status).toBe("cancelled");
			expect(mockProvider.cancelDelivery).toHaveBeenCalled();
		});

		it("cancels locally even when provider API fails", async () => {
			const deliveryId = await createTestDelivery();
			mockProvider.cancelDelivery.mockRejectedValue(new Error("API error"));

			const cancelled = await controller.cancelDelivery(deliveryId);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("returns null for delivered delivery", async () => {
			const deliveryId = await createTestDelivery();

			// Mark as delivered first
			await controller.updateDeliveryStatus(deliveryId, "delivered");

			const result = await controller.cancelDelivery(deliveryId);
			expect(result).toBeNull();
		});

		it("returns null for already cancelled delivery", async () => {
			const deliveryId = await createTestDelivery();
			mockProvider.cancelDelivery.mockResolvedValue(undefined);
			await controller.cancelDelivery(deliveryId);

			const result = await controller.cancelDelivery(deliveryId);
			expect(result).toBeNull();
		});

		it("returns null for failed delivery", async () => {
			const deliveryId = await createTestDelivery();
			await controller.updateDeliveryStatus(deliveryId, "failed");

			const result = await controller.cancelDelivery(deliveryId);
			expect(result).toBeNull();
		});
	});

	// ── updateDeliveryStatus ─────────────────────────────────────────

	describe("updateDeliveryStatus", () => {
		it("updates status with additional fields", async () => {
			mockProvider.createQuote.mockResolvedValue({
				id: "uber-quote-status",
				fee: 599,
				duration: 25,
				expires: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
			});
			const quote = await controller.requestQuote({
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
			});
			mockProvider.createDelivery.mockResolvedValue(makeUberDeliveryResponse());
			const delivery = await controller.createDelivery({
				orderId: "order-status",
				quoteId: quote.id,
			});
			if (!delivery) throw new Error("expected delivery");

			const updated = await controller.updateDeliveryStatus(
				delivery.id,
				"picked-up",
				{
					courierName: "Charlie",
					trackingUrl: "https://track.uber.com/updated",
					actualPickupTime: new Date("2026-03-27T14:00:00Z"),
				},
			);

			expect(updated?.status).toBe("picked-up");
			expect(updated?.courierName).toBe("Charlie");
			expect(updated?.trackingUrl).toBe("https://track.uber.com/updated");
		});

		it("returns null for non-existent delivery", async () => {
			const result = await controller.updateDeliveryStatus(
				"non-existent",
				"accepted",
			);
			expect(result).toBeNull();
		});
	});

	// ── getDeliveryStats ─────────────────────────────────────────────

	describe("getDeliveryStats", () => {
		it("computes stats across all deliveries", async () => {
			// Seed deliveries directly
			const deliveries = [
				{ id: "d1", status: "pending", fee: 500, tip: 100 },
				{ id: "d2", status: "accepted", fee: 600, tip: 200 },
				{ id: "d3", status: "delivered", fee: 700, tip: 150 },
				{ id: "d4", status: "cancelled", fee: 400, tip: 0 },
				{ id: "d5", status: "failed", fee: 300, tip: 50 },
				{ id: "d6", status: "picked-up", fee: 550, tip: 100 },
			];

			for (const d of deliveries) {
				await mockData.upsert(
					"delivery",
					d.id,
					d as unknown as Record<string, unknown>,
				);
			}

			const stats = await controller.getDeliveryStats();
			expect(stats.totalDeliveries).toBe(6);
			expect(stats.totalPending).toBe(1);
			expect(stats.totalAccepted).toBe(1);
			expect(stats.totalPickedUp).toBe(1);
			expect(stats.totalDelivered).toBe(1);
			expect(stats.totalCancelled).toBe(1);
			expect(stats.totalFailed).toBe(1);
			expect(stats.totalFees).toBe(3050);
			expect(stats.totalTips).toBe(600);
		});

		it("returns zeros when no deliveries exist", async () => {
			const stats = await controller.getDeliveryStats();
			expect(stats.totalDeliveries).toBe(0);
			expect(stats.totalFees).toBe(0);
			expect(stats.totalTips).toBe(0);
		});

		it("counts quoted status as pending", async () => {
			await mockData.upsert("delivery", "d1", {
				id: "d1",
				status: "quoted",
				fee: 500,
				tip: 0,
			});

			const stats = await controller.getDeliveryStats();
			expect(stats.totalPending).toBe(1);
		});
	});

	// ── listDeliveries and listQuotes ────────────────────────────────

	describe("listDeliveries", () => {
		it("filters by orderId", async () => {
			await mockData.upsert("delivery", "d1", {
				id: "d1",
				orderId: "order-A",
				status: "pending",
			});
			await mockData.upsert("delivery", "d2", {
				id: "d2",
				orderId: "order-B",
				status: "pending",
			});

			const results = await controller.listDeliveries({
				orderId: "order-A",
			});
			expect(results).toHaveLength(1);
			expect(results[0].orderId).toBe("order-A");
		});
	});

	describe("listQuotes", () => {
		it("filters by status", async () => {
			await mockData.upsert("quote", "q1", {
				id: "q1",
				status: "active",
			});
			await mockData.upsert("quote", "q2", {
				id: "q2",
				status: "used",
			});

			const active = await controller.listQuotes({ status: "active" });
			expect(active).toHaveLength(1);
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await mockData.upsert("quote", `q${i}`, {
					id: `q${i}`,
					status: "active",
				});
			}

			const page = await controller.listQuotes({ take: 2 });
			expect(page).toHaveLength(2);
		});
	});
});
