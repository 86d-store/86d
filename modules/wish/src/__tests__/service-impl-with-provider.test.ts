import { createMockDataService } from "@86d-app/core/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWishController } from "../service-impl";

// Tests that verify the service-impl calls the Wish provider when configured.

function mockOk(body: unknown) {
	return {
		ok: true,
		status: 200,
		json: () => Promise.resolve(body),
	};
}

describe("createWishController (with provider)", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let fetchSpy: ReturnType<typeof vi.fn>;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		mockData = createMockDataService();
		fetchSpy = vi.fn();
		globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	function makeController() {
		return createWishController(mockData, undefined, {
			accessToken: "test-token",
		});
	}

	// ── createProduct ──────────────────────────────────────────────────────────

	describe("createProduct with provider", () => {
		it("calls Wish API and stores wishProductId on success", async () => {
			fetchSpy.mockResolvedValueOnce(
				mockOk({
					code: 0,
					data: {
						Product: {
							id: "wish-ext-id",
							name: "Test",
							tags: [],
							price: { amount: 9.99, currency_code: "USD" },
							shipping: { amount: 2.0, currency_code: "USD" },
							enabled: true,
						},
					},
				}),
			);

			const controller = makeController();
			const product = await controller.createProduct({
				localProductId: "local-1",
				title: "Test",
				price: 9.99,
				shippingPrice: 2.0,
			});

			expect(product.wishProductId).toBe("wish-ext-id");
			expect(product.lastSyncedAt).toBeInstanceOf(Date);
			expect(product.error).toBeUndefined();
			expect(fetchSpy).toHaveBeenCalledTimes(1);
			const [url] = fetchSpy.mock.calls[0] as [string];
			expect(url).toContain("/api/v2/add");
		});

		it("stores error string and continues when Wish API fails", async () => {
			fetchSpy.mockResolvedValueOnce(
				mockOk({ code: 4, message: "Invalid token" }),
			);

			const controller = makeController();
			const product = await controller.createProduct({
				localProductId: "local-2",
				title: "Test",
				price: 5,
				shippingPrice: 1,
			});

			// Product still saved locally
			expect(product.id).toBeDefined();
			expect(product.wishProductId).toBeUndefined();
			expect(product.error).toContain("Invalid token");
		});
	});

	// ── disableProduct ─────────────────────────────────────────────────────────

	describe("disableProduct with provider", () => {
		it("calls Wish API when wishProductId is set", async () => {
			// First create with a wishProductId already set
			fetchSpy.mockResolvedValueOnce(
				mockOk({
					code: 0,
					data: {
						Product: {
							id: "wish-ext-2",
							name: "P",
							tags: [],
							price: { amount: 5, currency_code: "USD" },
							shipping: { amount: 1, currency_code: "USD" },
							enabled: true,
						},
					},
				}),
			);
			fetchSpy.mockResolvedValueOnce(mockOk({ code: 0 }));

			const controller = makeController();
			const product = await controller.createProduct({
				localProductId: "local-3",
				title: "P",
				price: 5,
				shippingPrice: 1,
			});

			const disabled = await controller.disableProduct(product.id);

			expect(disabled?.status).toBe("disabled");
			expect(fetchSpy).toHaveBeenCalledTimes(2);
			const [url] = fetchSpy.mock.calls[1] as [string];
			expect(url).toContain("/api/v2/remove");
			expect(url).toContain("id=wish-ext-2");
		});

		it("skips API call when product has no wishProductId", async () => {
			const controller = makeController();
			// Create without Wish API (fetchSpy returns error so wishProductId won't be set)
			fetchSpy.mockResolvedValueOnce(mockOk({ code: 1, message: "err" }));
			const product = await controller.createProduct({
				localProductId: "local-4",
				title: "P2",
				price: 5,
				shippingPrice: 1,
			});

			fetchSpy.mockClear();
			await controller.disableProduct(product.id);

			// No additional API call since no wishProductId
			expect(fetchSpy).not.toHaveBeenCalled();
		});
	});

	// ── shipOrder ──────────────────────────────────────────────────────────────

	describe("shipOrder with provider", () => {
		it("calls Wish API to fulfill the order", async () => {
			fetchSpy.mockResolvedValueOnce(mockOk({ code: 0 }));

			const controller = makeController();
			// Store a local order first
			const order = await controller.receiveOrder({
				wishOrderId: "wish-order-99",
				items: [],
				orderTotal: 11.99,
				shippingTotal: 2.0,
				wishFee: 1.0,
			});

			const shipped = await controller.shipOrder(order.id, "TRACK999", "usps");

			expect(shipped?.status).toBe("shipped");
			expect(shipped?.trackingNumber).toBe("TRACK999");
			expect(fetchSpy).toHaveBeenCalledTimes(1);
			const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
			expect(url).toContain("/api/v2/order/fulfill-one");
			const body = new URLSearchParams(init.body as string);
			expect(body.get("id")).toBe("wish-order-99");
			expect(body.get("tracking_number")).toBe("TRACK999");
		});

		it("still saves locally when the Wish API ship call fails", async () => {
			fetchSpy.mockResolvedValueOnce(
				mockOk({ code: 5, message: "Already shipped" }),
			);

			const controller = makeController();
			const order = await controller.receiveOrder({
				wishOrderId: "wish-order-100",
				items: [],
				orderTotal: 8,
				shippingTotal: 1,
				wishFee: 0.5,
			});

			const shipped = await controller.shipOrder(order.id, "T1", "fedex");

			// Status is updated locally even if API fails
			expect(shipped?.status).toBe("shipped");
		});
	});
});
