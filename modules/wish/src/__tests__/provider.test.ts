import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type WishApiProduct, WishProvider } from "../provider";

// ── Helpers ──────────────────────────────────────────────────────────────────

const ACCESS_TOKEN = "test-access-token";

function mockOk(body: unknown, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(body),
	};
}

function wishProduct(overrides: Partial<WishApiProduct> = {}): WishApiProduct {
	return {
		id: "wish-prod-1",
		parent_sku: "SKU-001",
		name: "Test Product",
		tags: ["tag1"],
		price: { amount: 9.99, currency_code: "USD" },
		shipping: { amount: 2.0, currency_code: "USD" },
		inventory: 10,
		enabled: true,
		...overrides,
	};
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("WishProvider", () => {
	let provider: WishProvider;
	let fetchSpy: ReturnType<typeof vi.fn>;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		provider = new WishProvider({ accessToken: ACCESS_TOKEN });
		fetchSpy = vi.fn();
		globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	// ── createProduct ─────────────────────────────────────────────────────────

	describe("createProduct", () => {
		it("POSTs to /add and returns the created product", async () => {
			fetchSpy.mockResolvedValueOnce(
				mockOk({ code: 0, data: { Product: wishProduct() } }),
			);

			const result = await provider.createProduct({
				parentSku: "SKU-001",
				name: "Test Product",
				basePrice: 9.99,
				shipping: 2.0,
				inventory: 10,
				tags: ["tag1"],
			});

			expect(result.id).toBe("wish-prod-1");
			expect(result.name).toBe("Test Product");

			const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
			expect(url).toBe("https://merchant.wish.com/api/v2/add");
			expect(init.method).toBe("POST");
			expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
				"application/x-www-form-urlencoded",
			);
			const body = new URLSearchParams(init.body as string);
			expect(body.get("access_token")).toBe(ACCESS_TOKEN);
			expect(body.get("name")).toBe("Test Product");
			expect(body.get("base_price")).toBe("9.99");
			expect(body.get("shipping")).toBe("2");
			expect(body.get("inventory")).toBe("10");
			expect(body.get("tags")).toBe("tag1");
		});

		it("throws when the API returns a non-zero code", async () => {
			fetchSpy.mockResolvedValueOnce(
				mockOk({ code: 4, message: "Invalid access token" }),
			);

			await expect(
				provider.createProduct({ name: "X", basePrice: 1, shipping: 0 }),
			).rejects.toThrow("Invalid access token");
		});
	});

	// ── updateProduct ─────────────────────────────────────────────────────────

	describe("updateProduct", () => {
		it("PUTs to /update with the product id", async () => {
			fetchSpy.mockResolvedValueOnce(
				mockOk({
					code: 0,
					data: { Product: wishProduct({ name: "Updated" }) },
				}),
			);

			const result = await provider.updateProduct("wish-prod-1", {
				name: "Updated",
				basePrice: 12.99,
			});

			expect(result.name).toBe("Updated");

			const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
			expect(url).toBe("https://merchant.wish.com/api/v2/update");
			expect(init.method).toBe("PUT");
			const body = new URLSearchParams(init.body as string);
			expect(body.get("id")).toBe("wish-prod-1");
			expect(body.get("name")).toBe("Updated");
			expect(body.get("base_price")).toBe("12.99");
		});

		it("throws on API error", async () => {
			fetchSpy.mockResolvedValueOnce(
				mockOk({ code: 2, message: "Product not found" }),
			);

			await expect(
				provider.updateProduct("bad-id", { name: "X" }),
			).rejects.toThrow("Product not found");
		});
	});

	// ── disableProduct ────────────────────────────────────────────────────────

	describe("disableProduct", () => {
		it("DELETEs to /remove with access_token in query string", async () => {
			fetchSpy.mockResolvedValueOnce(mockOk({ code: 0 }));

			await provider.disableProduct("wish-prod-1");

			const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
			expect(url).toContain("https://merchant.wish.com/api/v2/remove");
			expect(url).toContain("access_token=test-access-token");
			expect(url).toContain("id=wish-prod-1");
			expect(init.method).toBe("DELETE");
		});

		it("throws on API error", async () => {
			fetchSpy.mockResolvedValueOnce(mockOk({ code: 3, message: "Not found" }));

			await expect(provider.disableProduct("bad-id")).rejects.toThrow(
				"Not found",
			);
		});
	});

	// ── getProduct ────────────────────────────────────────────────────────────

	describe("getProduct", () => {
		it("GETs from /product and returns the product", async () => {
			fetchSpy.mockResolvedValueOnce(
				mockOk({ code: 0, data: { Product: wishProduct() } }),
			);

			const result = await provider.getProduct("wish-prod-1");

			expect(result?.id).toBe("wish-prod-1");
			const [url] = fetchSpy.mock.calls[0] as [string];
			expect(url).toContain("https://merchant.wish.com/api/v2/product");
			expect(url).toContain("id=wish-prod-1");
		});

		it("returns null when the API returns an error code", async () => {
			fetchSpy.mockResolvedValueOnce(mockOk({ code: 1, message: "Not found" }));

			const result = await provider.getProduct("missing");
			expect(result).toBeNull();
		});
	});

	// ── listOrders ────────────────────────────────────────────────────────────

	describe("listOrders", () => {
		const wishOrder = {
			order_id: "order-1",
			order_time: 1700000000,
			quantity: 1,
			product_id: "wish-prod-1",
			product_name: "Test Product",
			price: { amount: 9.99, currency_code: "USD" },
			shipping: { amount: 2.0, currency_code: "USD" },
			state: "APPROVED",
		};

		it("GETs from /order and returns the list", async () => {
			fetchSpy.mockResolvedValueOnce(
				mockOk({ code: 0, data: { orders: [wishOrder] } }),
			);

			const result = await provider.listOrders({
				state: "APPROVED",
				count: 10,
			});

			expect(result).toHaveLength(1);
			expect(result[0].order_id).toBe("order-1");

			const [url] = fetchSpy.mock.calls[0] as [string];
			expect(url).toContain("https://merchant.wish.com/api/v2/order");
			expect(url).toContain("state=APPROVED");
			expect(url).toContain("count=10");
		});

		it("returns empty array on API error", async () => {
			fetchSpy.mockResolvedValueOnce(mockOk({ code: 1, message: "Error" }));

			const result = await provider.listOrders({});
			expect(result).toEqual([]);
		});

		it("uses default count of 50 when not specified", async () => {
			fetchSpy.mockResolvedValueOnce(mockOk({ code: 0, data: { orders: [] } }));

			await provider.listOrders({});

			const [url] = fetchSpy.mock.calls[0] as [string];
			expect(url).toContain("count=50");
		});
	});

	// ── shipOrder ─────────────────────────────────────────────────────────────

	describe("shipOrder", () => {
		it("POSTs to /order/fulfill-one with tracking info", async () => {
			fetchSpy.mockResolvedValueOnce(mockOk({ code: 0 }));

			await provider.shipOrder({
				orderId: "order-1",
				trackingNumber: "TRACK123",
				carrier: "ups",
			});

			const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
			expect(url).toBe("https://merchant.wish.com/api/v2/order/fulfill-one");
			expect(init.method).toBe("POST");
			const body = new URLSearchParams(init.body as string);
			expect(body.get("id")).toBe("order-1");
			expect(body.get("tracking_number")).toBe("TRACK123");
			expect(body.get("carrier")).toBe("ups");
		});

		it("throws when the API returns a non-zero code", async () => {
			fetchSpy.mockResolvedValueOnce(
				mockOk({ code: 5, message: "Order already fulfilled" }),
			);

			await expect(
				provider.shipOrder({
					orderId: "order-1",
					trackingNumber: "TRACK",
					carrier: "usps",
				}),
			).rejects.toThrow("Order already fulfilled");
		});

		it("includes shipping_date when provided", async () => {
			fetchSpy.mockResolvedValueOnce(mockOk({ code: 0 }));

			await provider.shipOrder({
				orderId: "order-2",
				trackingNumber: "T456",
				carrier: "fedex",
				shippingDate: "2026-05-02",
			});

			const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
			const body = new URLSearchParams(init.body as string);
			expect(body.get("shipping_date")).toBe("2026-05-02");
		});
	});
});
