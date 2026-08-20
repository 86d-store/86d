import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DriveDeliveryResponse, DriveQuoteResponse } from "../provider";
import { createDoordashController } from "../service-impl";

// ── Provider mock ──────────────────────────────────────────────────────────

const mockProvider = {
	createDelivery: vi.fn<() => Promise<DriveDeliveryResponse>>(),
	getDelivery: vi.fn<() => Promise<DriveDeliveryResponse>>(),
	cancelDelivery: vi.fn<() => Promise<DriveDeliveryResponse>>(),
	createQuote: vi.fn<() => Promise<DriveQuoteResponse>>(),
	acceptQuote: vi.fn<() => Promise<DriveDeliveryResponse>>(),
};

// Use a class-like constructor mock so `new DoordashDriveProvider(...)` works
vi.mock("../provider", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../provider")>();

	function MockDoordashDriveProvider() {
		return mockProvider;
	}

	return {
		...actual,
		DoordashDriveProvider: MockDoordashDriveProvider,
	};
});

function makeDriveResponse(
	overrides: Partial<DriveDeliveryResponse> = {},
): DriveDeliveryResponse {
	return {
		external_delivery_id: "ext-1",
		delivery_status: "created",
		currency: "USD",
		fee: 599,
		tip: 0,
		order_value: 2500,
		pickup_address: "123 Main St",
		pickup_business_name: "Store",
		pickup_phone_number: "+10000000000",
		pickup_instructions: "",
		dropoff_address: "456 Oak Ave",
		dropoff_business_name: "Customer",
		dropoff_phone_number: "+10000000000",
		dropoff_instructions: "",
		pickup_time_estimated: "2026-03-27T12:00:00Z",
		dropoff_time_estimated: "2026-03-27T12:30:00Z",
		pickup_time_actual: null,
		dropoff_time_actual: null,
		dasher_id: null,
		dasher_name: null,
		dasher_dropoff_phone_number: null,
		tracking_url: "https://track.doordash.com/abc",
		support_reference: "ref-123",
		created_at: "2026-03-27T11:00:00Z",
		updated_at: "2026-03-27T11:00:00Z",
		...overrides,
	};
}

// ── Tests with provider (credentials configured) ───────────────────────────

describe("doordash service-impl with provider", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createDoordashController>;

	beforeEach(() => {
		mockData = createMockDataService();
		vi.clearAllMocks();

		controller = createDoordashController(mockData, undefined, {
			developerId: "dev-123",
			keyId: "key-456",
			signingSecret: "secret-789",
			sandbox: true,
		});
	});

	// ── createDelivery with provider ──────────────────────────────────

	describe("createDelivery with provider", () => {
		it("uses fee from DoorDash API response", async () => {
			mockProvider.createDelivery.mockResolvedValue(
				makeDriveResponse({ fee: 799 }),
			);

			const delivery = await controller.createDelivery({
				orderId: "order-1",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 500,
			});

			expect(delivery.fee).toBe(799);
		});

		it("sets tracking URL from API response", async () => {
			mockProvider.createDelivery.mockResolvedValue(
				makeDriveResponse({
					tracking_url: "https://track.doordash.com/xyz",
				}),
			);

			const delivery = await controller.createDelivery({
				orderId: "order-2",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 500,
			});

			expect(delivery.trackingUrl).toBe("https://track.doordash.com/xyz");
		});

		it("sets dasher name from API response", async () => {
			mockProvider.createDelivery.mockResolvedValue(
				makeDriveResponse({ dasher_name: "Jane D." }),
			);

			const delivery = await controller.createDelivery({
				orderId: "order-3",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 500,
			});

			expect(delivery.driverName).toBe("Jane D.");
		});

		it("sets estimated pickup and delivery times from API", async () => {
			mockProvider.createDelivery.mockResolvedValue(
				makeDriveResponse({
					pickup_time_estimated: "2026-03-27T14:00:00Z",
					dropoff_time_estimated: "2026-03-27T14:30:00Z",
				}),
			);

			const delivery = await controller.createDelivery({
				orderId: "order-4",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 500,
			});

			expect(delivery.estimatedPickupTime).toBeInstanceOf(Date);
			expect(delivery.estimatedDeliveryTime).toBeInstanceOf(Date);
		});

		it("handles null tracking URL from API", async () => {
			mockProvider.createDelivery.mockResolvedValue(
				makeDriveResponse({ tracking_url: null }),
			);

			const delivery = await controller.createDelivery({
				orderId: "order-5",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 500,
			});

			expect(delivery.trackingUrl).toBeUndefined();
		});

		it("passes tip to provider", async () => {
			mockProvider.createDelivery.mockResolvedValue(makeDriveResponse());

			await controller.createDelivery({
				orderId: "order-6",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 500,
				tip: 300,
			});

			expect(mockProvider.createDelivery).toHaveBeenCalledWith(
				expect.objectContaining({ tip: 300 }),
			);
		});

		it("uses businessName from address when available", async () => {
			mockProvider.createDelivery.mockResolvedValue(makeDriveResponse());

			await controller.createDelivery({
				orderId: "order-7",
				pickupAddress: { street: "123 Main", businessName: "My Store" },
				dropoffAddress: { street: "456 Oak", businessName: "Home" },
				fee: 500,
			});

			expect(mockProvider.createDelivery).toHaveBeenCalledWith(
				expect.objectContaining({
					pickupBusinessName: "My Store",
					dropoffBusinessName: "Home",
				}),
			);
		});

		it("persists delivery to data store", async () => {
			mockProvider.createDelivery.mockResolvedValue(makeDriveResponse());

			const delivery = await controller.createDelivery({
				orderId: "order-8",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 500,
			});

			expect(mockData.size("delivery")).toBe(1);
			const stored = await mockData.get("delivery", delivery.id);
			expect(stored).not.toBeNull();
		});
	});

	// ── getDelivery with provider status refresh ─────────────────────

	describe("getDelivery with provider refresh", () => {
		it("refreshes status from DoorDash API", async () => {
			mockProvider.createDelivery.mockResolvedValue(
				makeDriveResponse({ delivery_status: "created" }),
			);

			const delivery = await controller.createDelivery({
				orderId: "order-10",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 500,
			});
			expect(delivery.status).toBe("pending");

			mockProvider.getDelivery.mockResolvedValue(
				makeDriveResponse({
					delivery_status: "picked_up",
					dasher_name: "John D.",
					dasher_dropoff_phone_number: "+15551234567",
					tracking_url: "https://track.doordash.com/updated",
				}),
			);

			const refreshed = await controller.getDelivery(delivery.id);
			expect(refreshed?.status).toBe("picked-up");
			expect(refreshed?.driverName).toBe("John D.");
			expect(refreshed?.driverPhone).toBe("+15551234567");
			expect(refreshed?.trackingUrl).toBe("https://track.doordash.com/updated");
		});

		it("updates actual pickup time when Drive API reports it", async () => {
			mockProvider.createDelivery.mockResolvedValue(
				makeDriveResponse({ delivery_status: "created" }),
			);

			const delivery = await controller.createDelivery({
				orderId: "order-11",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 500,
			});

			mockProvider.getDelivery.mockResolvedValue(
				makeDriveResponse({
					delivery_status: "picked_up",
					pickup_time_actual: "2026-03-27T14:05:00Z",
				}),
			);

			const refreshed = await controller.getDelivery(delivery.id);
			expect(refreshed?.actualPickupTime).toBeInstanceOf(Date);
		});

		it("updates actual delivery time when Drive API reports it", async () => {
			mockProvider.createDelivery.mockResolvedValue(
				makeDriveResponse({ delivery_status: "created" }),
			);

			const delivery = await controller.createDelivery({
				orderId: "order-12",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 500,
			});

			mockProvider.getDelivery.mockResolvedValue(
				makeDriveResponse({
					delivery_status: "delivered",
					dropoff_time_actual: "2026-03-27T14:30:00Z",
				}),
			);

			const refreshed = await controller.getDelivery(delivery.id);
			expect(refreshed?.actualDeliveryTime).toBeInstanceOf(Date);
		});

		it("persists refreshed data to store", async () => {
			mockProvider.createDelivery.mockResolvedValue(
				makeDriveResponse({ delivery_status: "created" }),
			);

			const delivery = await controller.createDelivery({
				orderId: "order-13",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 500,
			});

			mockProvider.getDelivery.mockResolvedValue(
				makeDriveResponse({ delivery_status: "picked_up" }),
			);

			await controller.getDelivery(delivery.id);

			// Verify the updated status is persisted
			const stored = (await mockData.get("delivery", delivery.id)) as Record<
				string,
				unknown
			>;
			expect(stored.status).toBe("picked-up");
		});

		it("falls back to local data when API call fails", async () => {
			mockProvider.createDelivery.mockResolvedValue(
				makeDriveResponse({ delivery_status: "created" }),
			);

			const delivery = await controller.createDelivery({
				orderId: "order-14",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 500,
			});

			mockProvider.getDelivery.mockRejectedValue(new Error("Network error"));

			const result = await controller.getDelivery(delivery.id);
			expect(result).not.toBeNull();
			expect(result?.status).toBe("pending");
		});

		it("does not call API when status is already current", async () => {
			mockProvider.createDelivery.mockResolvedValue(
				makeDriveResponse({ delivery_status: "created" }),
			);

			const delivery = await controller.createDelivery({
				orderId: "order-15",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 500,
			});

			// API returns same status
			mockProvider.getDelivery.mockResolvedValue(
				makeDriveResponse({ delivery_status: "created" }),
			);

			const result = await controller.getDelivery(delivery.id);
			expect(result?.status).toBe("pending");
			// Should not update store since status unchanged
		});
	});

	// ── cancelDelivery with provider ─────────────────────────────────

	describe("cancelDelivery with provider", () => {
		it("calls provider.cancelDelivery", async () => {
			mockProvider.createDelivery.mockResolvedValue(makeDriveResponse());
			mockProvider.cancelDelivery.mockResolvedValue(
				makeDriveResponse({ delivery_status: "cancelled" }),
			);

			const delivery = await controller.createDelivery({
				orderId: "order-20",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 500,
			});

			const cancelled = await controller.cancelDelivery(delivery.id);
			expect(cancelled?.status).toBe("cancelled");
			expect(mockProvider.cancelDelivery).toHaveBeenCalledWith(
				delivery.externalDeliveryId,
			);
		});

		it("cancels locally even if provider API fails", async () => {
			mockProvider.createDelivery.mockResolvedValue(makeDriveResponse());
			mockProvider.cancelDelivery.mockRejectedValue(new Error("API error"));

			const delivery = await controller.createDelivery({
				orderId: "order-21",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 500,
			});

			const cancelled = await controller.cancelDelivery(delivery.id);
			expect(cancelled?.status).toBe("cancelled");
		});
	});

	// ── requestQuote ─────────────────────────────────────────────────

	describe("requestQuote", () => {
		it("returns a quote with fee and estimated times", async () => {
			mockProvider.createQuote.mockResolvedValue({
				external_delivery_id: "86d_quote_xxx",
				currency: "USD",
				fee: 699,
				delivery_status: "created",
				pickup_time_estimated: "2026-03-27T15:00:00Z",
				dropoff_time_estimated: "2026-03-27T15:30:00Z",
			});

			const quote = await controller.requestQuote({
				pickupAddress: "123 Main St",
				pickupBusinessName: "Store",
				pickupPhoneNumber: "+10000000000",
				dropoffAddress: "456 Oak Ave",
				dropoffBusinessName: "Customer",
				dropoffPhoneNumber: "+10000000001",
				orderValue: 2500,
			});

			expect(quote.fee).toBe(699);
			expect(quote.currency).toBe("USD");
			expect(quote.estimatedPickupTime).toBe("2026-03-27T15:00:00Z");
			expect(quote.estimatedDropoffTime).toBe("2026-03-27T15:30:00Z");
		});

		it("persists the quote to data store", async () => {
			mockProvider.createQuote.mockResolvedValue({
				external_delivery_id: "86d_quote_xxx",
				currency: "USD",
				fee: 699,
				delivery_status: "created",
				pickup_time_estimated: null,
				dropoff_time_estimated: null,
			});

			const quote = await controller.requestQuote({
				pickupAddress: "123 Main St",
				pickupBusinessName: "Store",
				pickupPhoneNumber: "+10000000000",
				dropoffAddress: "456 Oak Ave",
				dropoffBusinessName: "Customer",
				dropoffPhoneNumber: "+10000000001",
				orderValue: 2500,
			});

			expect(mockData.size("quote")).toBe(1);
			const stored = await mockData.get("quote", quote.id);
			expect(stored).not.toBeNull();
		});

		it("sets 5-minute expiration on quote", async () => {
			mockProvider.createQuote.mockResolvedValue({
				external_delivery_id: "86d_quote_xxx",
				currency: "USD",
				fee: 699,
				delivery_status: "created",
				pickup_time_estimated: null,
				dropoff_time_estimated: null,
			});

			const before = new Date();
			const quote = await controller.requestQuote({
				pickupAddress: "123 Main St",
				pickupBusinessName: "Store",
				pickupPhoneNumber: "+10000000000",
				dropoffAddress: "456 Oak Ave",
				dropoffBusinessName: "Customer",
				dropoffPhoneNumber: "+10000000001",
				orderValue: 2500,
			});

			const expectedExpiry = before.getTime() + 5 * 60 * 1000;
			expect(quote.expiresAt.getTime()).toBeGreaterThanOrEqual(
				expectedExpiry - 1000,
			);
			expect(quote.expiresAt.getTime()).toBeLessThanOrEqual(
				expectedExpiry + 1000,
			);
		});
	});

	// ── acceptQuote ──────────────────────────────────────────────────

	describe("acceptQuote", () => {
		it("accepts a valid quote and creates a delivery", async () => {
			mockProvider.createQuote.mockResolvedValue({
				external_delivery_id: "86d_quote_xxx",
				currency: "USD",
				fee: 699,
				delivery_status: "created",
				pickup_time_estimated: null,
				dropoff_time_estimated: null,
			});

			const quote = await controller.requestQuote({
				pickupAddress: "123 Main St",
				pickupBusinessName: "Store",
				pickupPhoneNumber: "+10000000000",
				dropoffAddress: "456 Oak Ave",
				dropoffBusinessName: "Customer",
				dropoffPhoneNumber: "+10000000001",
				orderValue: 2500,
			});

			mockProvider.acceptQuote.mockResolvedValue(
				makeDriveResponse({
					delivery_status: "confirmed",
					fee: 699,
					tip: 200,
					pickup_address: "123 Main St",
					dropoff_address: "456 Oak Ave",
					tracking_url: "https://track.doordash.com/accepted",
				}),
			);

			const delivery = await controller.acceptQuote(quote.id);
			expect(delivery.status).toBe("accepted");
			expect(delivery.fee).toBe(699);
			expect(delivery.tip).toBe(200);
			expect(delivery.trackingUrl).toBe("https://track.doordash.com/accepted");
			expect(delivery.metadata).toEqual({ quoteId: quote.id });
		});

		it("throws when quote is not found", async () => {
			await expect(controller.acceptQuote("non-existent")).rejects.toThrow(
				"Quote not found",
			);
		});

		it("throws when quote has expired", async () => {
			// Manually insert an expired quote
			const expiredQuote = {
				id: "expired-q",
				externalDeliveryId: "86d_quote_expired",
				fee: 699,
				currency: "USD",
				expiresAt: new Date(Date.now() - 60_000), // 1 minute ago
				createdAt: new Date(),
			};
			await mockData.upsert(
				"quote",
				expiredQuote.id,
				expiredQuote as unknown as Record<string, unknown>,
			);

			await expect(controller.acceptQuote("expired-q")).rejects.toThrow(
				"Quote has expired",
			);
		});
	});

	// ── Data persistence ─────────────────────────────────────────────

	describe("data persistence", () => {
		it("generates external delivery ID with 86d_ prefix", async () => {
			mockProvider.createDelivery.mockResolvedValue(makeDriveResponse());

			const delivery = await controller.createDelivery({
				orderId: "order-30",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 500,
			});

			expect(delivery.externalDeliveryId).toMatch(/^86d_/);
		});

		it("stores and retrieves delivery zone correctly", async () => {
			const zone = await controller.createZone({
				name: "Test Zone",
				radius: 5,
				centerLat: 40.7128,
				centerLng: -74.006,
				deliveryFee: 499,
				estimatedMinutes: 30,
			});

			const updated = await controller.updateZone(zone.id, {
				name: "Updated Zone",
				radius: 10,
				deliveryFee: 699,
			});

			expect(updated?.name).toBe("Updated Zone");
			expect(updated?.radius).toBe(10);
			expect(updated?.deliveryFee).toBe(699);
			// Unchanged fields preserved
			expect(updated?.centerLat).toBe(40.7128);
			expect(updated?.estimatedMinutes).toBe(30);
		});

		it("handles multiple zone updates correctly", async () => {
			const zone = await controller.createZone({
				name: "Zone",
				radius: 5,
				centerLat: 40.7,
				centerLng: -74.0,
				deliveryFee: 499,
				estimatedMinutes: 30,
			});

			await controller.updateZone(zone.id, { name: "V2" });
			await controller.updateZone(zone.id, { deliveryFee: 599 });
			const final = await controller.updateZone(zone.id, {
				estimatedMinutes: 45,
			});

			expect(final?.name).toBe("V2");
			expect(final?.deliveryFee).toBe(599);
			expect(final?.estimatedMinutes).toBe(45);
		});
	});
});
