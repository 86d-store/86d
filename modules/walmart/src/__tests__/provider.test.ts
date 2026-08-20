import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	extractOrderTotals,
	mapFeedStatus,
	mapFulfillmentType,
	mapItemStatus,
	mapOrderStatus,
	type WalmartApiOrder,
	type WalmartApiOrderLine,
	WalmartProvider,
} from "../provider";

// ── Helpers ──────────────────────────────────────────────────────────────────

const CONFIG = {
	clientId: "test-client-id",
	clientSecret: "test-client-secret",
	channelType: "test-channel",
};

function mockFetchResponse(body: unknown, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: () => Promise.resolve(body),
		text: () => Promise.resolve(JSON.stringify(body)),
	};
}

function mockFetchEmpty(status = 204) {
	return {
		ok: true,
		status,
		json: () => Promise.resolve(null),
		text: () => Promise.resolve(""),
	};
}

const TOKEN_RESPONSE = {
	access_token: "test-access-token",
	token_type: "Bearer",
	expires_in: 900,
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("WalmartProvider", () => {
	let provider: WalmartProvider;
	let fetchSpy: ReturnType<typeof vi.fn>;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		provider = new WalmartProvider(CONFIG);
		fetchSpy = vi.fn();
		globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	// ── Verify connection ────────────────────────────────────────────────

	describe("verifyConnection", () => {
		it("returns ok with live mode when Walmart returns a token", async () => {
			fetchSpy.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE));
			const result = await provider.verifyConnection();

			expect(result).toEqual({ ok: true, mode: "live" });

			const call = fetchSpy.mock.calls[0];
			expect(call[0]).toBe("https://marketplace.walmartapis.com/v3/token");
			expect(call[1].method).toBe("POST");
			expect(call[1].body).toContain("grant_type=client_credentials");
		});

		it("returns ok with sandbox mode and hits the sandbox token endpoint", async () => {
			const sandboxProvider = new WalmartProvider({
				...CONFIG,
				sandbox: true,
			});
			fetchSpy.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE));

			const result = await sandboxProvider.verifyConnection();

			expect(result).toEqual({ ok: true, mode: "sandbox" });
			expect(fetchSpy.mock.calls[0][0]).toBe(
				"https://sandbox.walmartapis.com/v3/token",
			);
		});

		it("returns error with Walmart message on 401", async () => {
			fetchSpy.mockResolvedValueOnce(
				mockFetchResponse(
					{
						errors: [
							{
								code: "INVALID_CREDENTIALS.GMP_GATEWAY_API",
								message: "Invalid credentials",
								severity: "ERROR",
							},
						],
					},
					401,
				),
			);
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "Invalid credentials",
			});
		});

		it("surfaces OAuth error_description when provided", async () => {
			fetchSpy.mockResolvedValueOnce(
				mockFetchResponse(
					{
						error: "invalid_client",
						error_description: "Client authentication failed",
					},
					401,
				),
			);
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "Client authentication failed",
			});
		});

		it("returns error with HTTP status when body is not JSON", async () => {
			fetchSpy.mockResolvedValueOnce({
				ok: false,
				status: 503,
				json: () => Promise.reject(new Error("invalid json")),
			});
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "HTTP 503",
			});
		});

		it("returns error when fetch throws", async () => {
			fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "ECONNREFUSED",
			});
		});

		it("caches the token so subsequent API calls don't re-authenticate", async () => {
			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(
					mockFetchResponse({ ItemResponse: [], totalItems: 0 }),
				);

			const verify = await provider.verifyConnection();
			expect(verify.ok).toBe(true);

			await provider.getItems();

			expect(fetchSpy).toHaveBeenCalledTimes(2);
			expect(fetchSpy.mock.calls[1][0]).toContain("/v3/items");
		});
	});

	// ── Authentication ─────────────────────────────────────────────────────

	describe("authentication", () => {
		it("obtains access token with client credentials grant", async () => {
			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(
					mockFetchResponse({ ItemResponse: [], totalItems: 0 }),
				);

			await provider.getItems();

			const tokenCall = fetchSpy.mock.calls[0];
			expect(tokenCall[0]).toBe("https://marketplace.walmartapis.com/v3/token");
			expect(tokenCall[1].method).toBe("POST");
			expect(tokenCall[1].headers.Authorization).toMatch(/^Basic /);
			expect(tokenCall[1].headers["Content-Type"]).toBe(
				"application/x-www-form-urlencoded",
			);
			expect(tokenCall[1].body).toContain("grant_type=client_credentials");
		});

		it("uses Basic auth with base64-encoded clientId:clientSecret", async () => {
			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(
					mockFetchResponse({ ItemResponse: [], totalItems: 0 }),
				);

			await provider.getItems();

			const tokenCall = fetchSpy.mock.calls[0];
			const expected = btoa(`${CONFIG.clientId}:${CONFIG.clientSecret}`);
			expect(tokenCall[1].headers.Authorization).toBe(`Basic ${expected}`);
		});

		it("sends bearer token in WM_SEC.ACCESS_TOKEN header", async () => {
			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(
					mockFetchResponse({ ItemResponse: [], totalItems: 0 }),
				);

			await provider.getItems();

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[1].headers["WM_SEC.ACCESS_TOKEN"]).toBe(
				"test-access-token",
			);
		});

		it("sends required Walmart headers", async () => {
			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(
					mockFetchResponse({ ItemResponse: [], totalItems: 0 }),
				);

			await provider.getItems();

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[1].headers["WM_SVC.NAME"]).toBe("86d-Commerce");
			expect(apiCall[1].headers["WM_QOS.CORRELATION_ID"]).toBeDefined();
			expect(apiCall[1].headers["WM_CONSUMER.CHANNEL.TYPE"]).toBe(
				"test-channel",
			);
		});

		it("caches token across requests", async () => {
			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(
					mockFetchResponse({ ItemResponse: [], totalItems: 0 }),
				)
				.mockResolvedValueOnce(
					mockFetchResponse({ ItemResponse: [], totalItems: 0 }),
				);

			await provider.getItems();
			await provider.getItems();

			// Token fetched once, API called twice
			expect(fetchSpy).toHaveBeenCalledTimes(3);
			expect(fetchSpy.mock.calls[0][0]).toContain("/v3/token");
			expect(fetchSpy.mock.calls[1][0]).toContain("/v3/items");
			expect(fetchSpy.mock.calls[2][0]).toContain("/v3/items");
		});

		it("throws on OAuth token failure", async () => {
			fetchSpy.mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: () => Promise.resolve("Invalid credentials"),
			});

			await expect(provider.getItems()).rejects.toThrow(
				"Walmart OAuth token error",
			);
		});
	});

	// ── Items API ──────────────────────────────────────────────────────────

	describe("items", () => {
		it("gets all items", async () => {
			const items = {
				ItemResponse: [
					{
						sku: "SKU-001",
						wpid: "wpid-1",
						productName: "Test Product",
						price: { currency: "USD", amount: 19.99 },
						publishedStatus: "PUBLISHED",
						lifecycleStatus: "ACTIVE",
						mart: "WALMART_US",
					},
				],
				totalItems: 1,
			};

			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(mockFetchResponse(items));

			const result = await provider.getItems();
			expect(result.totalItems).toBe(1);
			expect(result.ItemResponse[0].sku).toBe("SKU-001");

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toBe("https://marketplace.walmartapis.com/v3/items");
			expect(apiCall[1].method).toBe("GET");
		});

		it("passes limit and cursor parameters", async () => {
			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(
					mockFetchResponse({ ItemResponse: [], totalItems: 0 }),
				);

			await provider.getItems({ limit: 10, nextCursor: "abc123" });

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toContain("limit=10");
			expect(apiCall[0]).toContain("nextCursor=abc123");
		});

		it("gets a single item", async () => {
			const item = {
				sku: "SKU-001",
				wpid: "wpid-1",
				productName: "Test Product",
				price: { currency: "USD", amount: 19.99 },
				publishedStatus: "PUBLISHED",
				lifecycleStatus: "ACTIVE",
				mart: "WALMART_US",
			};

			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(mockFetchResponse(item));

			const result = await provider.getItem("wpid-1");
			expect(result.productName).toBe("Test Product");

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toContain("/v3/items/wpid-1");
		});

		it("retires an item", async () => {
			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(mockFetchEmpty());

			await provider.retireItem("SKU-001");

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toContain("/v3/items/SKU-001");
			expect(apiCall[1].method).toBe("DELETE");
		});
	});

	// ── Inventory API ──────────────────────────────────────────────────────

	describe("inventory", () => {
		it("gets inventory for a SKU", async () => {
			const inventory = {
				sku: "SKU-001",
				quantity: { unit: "EACH", amount: 50 },
			};

			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(mockFetchResponse(inventory));

			const result = await provider.getInventory("SKU-001");
			expect(result.quantity.amount).toBe(50);

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toContain("/v3/inventory?sku=SKU-001");
		});

		it("updates inventory for a SKU", async () => {
			const updated = {
				sku: "SKU-001",
				quantity: { unit: "EACH", amount: 100 },
			};

			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(mockFetchResponse(updated));

			const result = await provider.updateInventory("SKU-001", 100);
			expect(result.quantity.amount).toBe(100);

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toContain("/v3/inventory?sku=SKU-001");
			expect(apiCall[1].method).toBe("PUT");

			const body = JSON.parse(apiCall[1].body);
			expect(body.sku).toBe("SKU-001");
			expect(body.quantity.unit).toBe("EACH");
			expect(body.quantity.amount).toBe(100);
		});
	});

	// ── Feeds API ──────────────────────────────────────────────────────────

	describe("feeds", () => {
		it("submits a feed", async () => {
			const feedRes = { feedId: "feed-123" };

			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(mockFetchResponse(feedRes));

			const result = await provider.submitFeed("item", [
				{ sku: "SKU-001", productName: "Test" },
			]);
			expect(result.feedId).toBe("feed-123");

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toContain("/v3/feeds?feedType=item");
			expect(apiCall[1].method).toBe("POST");
		});

		it("gets feed status", async () => {
			const feedStatus = {
				feedId: "feed-123",
				feedType: "item",
				feedStatus: "PROCESSED",
				itemsReceived: 10,
				itemsSucceeded: 9,
				itemsFailed: 1,
				itemsProcessing: 0,
				feedSource: "API",
				partnerId: "partner-1",
				feedDate: "2024-01-15T00:00:00Z",
				modifiedDtm: "2024-01-15T01:00:00Z",
			};

			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(mockFetchResponse(feedStatus));

			const result = await provider.getFeedStatus("feed-123");
			expect(result.feedStatus).toBe("PROCESSED");
			expect(result.itemsSucceeded).toBe(9);

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toContain("/v3/feeds/feed-123");
		});
	});

	// ── Orders API ─────────────────────────────────────────────────────────

	describe("orders", () => {
		const mockOrder: WalmartApiOrder = {
			purchaseOrderId: "PO-12345",
			customerOrderId: "CO-12345",
			orderDate: "2024-01-15T10:00:00Z",
			shippingInfo: {
				methodCode: "Standard",
				postalAddress: {
					name: "John Doe",
					address1: "123 Main St",
					city: "Austin",
					state: "TX",
					postalCode: "78701",
					country: "US",
				},
			},
			orderLines: {
				orderLine: [
					{
						lineNumber: "1",
						item: {
							productName: "Test Product",
							sku: "SKU-001",
						},
						charges: {
							charge: [
								{
									chargeType: "PRODUCT",
									chargeAmount: { currency: "USD", amount: 19.99 },
								},
								{
									chargeType: "SHIPPING",
									chargeAmount: { currency: "USD", amount: 4.99 },
								},
							],
						},
						orderLineQuantity: {
							unitOfMeasurement: "EACH",
							amount: "1",
						},
						statusDate: "2024-01-15T10:00:00Z",
						orderLineStatuses: {
							orderLineStatus: [
								{
									status: "Created",
									statusQuantity: {
										unitOfMeasurement: "EACH",
										amount: "1",
									},
								},
							],
						},
					},
				],
			},
		};

		it("gets orders with filters", async () => {
			const ordersResponse = {
				list: {
					elements: { order: [mockOrder] },
					meta: { totalCount: 1, limit: 50 },
				},
			};

			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(mockFetchResponse(ordersResponse));

			const result = await provider.getOrders({
				createdStartDate: "2024-01-01T00:00:00Z",
				limit: 50,
			});

			expect(result.list.elements.order).toHaveLength(1);
			expect(result.list.elements.order[0].purchaseOrderId).toBe("PO-12345");

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toContain("/v3/orders");
			expect(apiCall[0]).toContain("limit=50");
		});

		it("gets a specific order", async () => {
			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(mockFetchResponse({ order: mockOrder }));

			const result = await provider.getOrder("PO-12345");
			expect(result.purchaseOrderId).toBe("PO-12345");

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toContain("/v3/orders/PO-12345");
		});

		it("acknowledges an order", async () => {
			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(mockFetchEmpty());

			await provider.acknowledgeOrder("PO-12345");

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toContain("/v3/orders/PO-12345/acknowledge");
			expect(apiCall[1].method).toBe("POST");
		});

		it("ships an order with tracking", async () => {
			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(mockFetchEmpty());

			await provider.shipOrder("PO-12345", {
				lineNumbers: ["1", "2"],
				trackingNumber: "1Z999AA10123",
				carrier: "UPS",
			});

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toContain("/v3/orders/PO-12345/shipping");
			expect(apiCall[1].method).toBe("POST");

			const body = JSON.parse(apiCall[1].body);
			expect(body.orderShipment.orderLines).toHaveLength(2);
			expect(
				body.orderShipment.orderLines[0].orderLineStatuses[0].trackingInfo
					.trackingNumber,
			).toBe("1Z999AA10123");
			expect(
				body.orderShipment.orderLines[0].orderLineStatuses[0].trackingInfo
					.carrierName.carrier,
			).toBe("UPS");
		});

		it("cancels an order", async () => {
			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(mockFetchEmpty());

			await provider.cancelOrder("PO-12345", ["1"]);

			const apiCall = fetchSpy.mock.calls[1];
			expect(apiCall[0]).toContain("/v3/orders/PO-12345/cancellation");
			expect(apiCall[1].method).toBe("POST");

			const body = JSON.parse(apiCall[1].body);
			expect(
				body.orderCancellation.orderLines[0].orderLineStatuses[0].status,
			).toBe("Cancelled");
			expect(
				body.orderCancellation.orderLines[0].orderLineStatuses[0]
					.cancellationReason,
			).toBe("CANCEL_BY_SELLER");
		});
	});

	// ── Error handling ─────────────────────────────────────────────────────

	describe("error handling", () => {
		it("throws descriptive error from API error response", async () => {
			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce({
					ok: false,
					status: 400,
					json: () =>
						Promise.resolve({
							errors: [
								{
									code: "INVALID_REQUEST",
									message: "The SKU is invalid.",
								},
							],
						}),
				});

			await expect(provider.getItem("bad-id")).rejects.toThrow(
				"Walmart API error: The SKU is invalid.",
			);
		});

		it("falls back to HTTP status on unparseable error", async () => {
			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
					json: () => Promise.reject(new Error("parse fail")),
				});

			await expect(provider.getItem("bad-id")).rejects.toThrow(
				"Walmart API error: HTTP 500",
			);
		});
	});

	// ── Sandbox mode ───────────────────────────────────────────────────────

	describe("sandbox mode", () => {
		it("uses sandbox URL when configured", async () => {
			const sandboxProvider = new WalmartProvider({
				...CONFIG,
				sandbox: true,
			});

			fetchSpy
				.mockResolvedValueOnce(mockFetchResponse(TOKEN_RESPONSE))
				.mockResolvedValueOnce(
					mockFetchResponse({ ItemResponse: [], totalItems: 0 }),
				);

			await sandboxProvider.getItems();

			expect(fetchSpy.mock.calls[0][0]).toContain("sandbox.walmartapis.com");
			expect(fetchSpy.mock.calls[1][0]).toContain("sandbox.walmartapis.com");
		});
	});
});

// ── Mapping helpers ──────────────────────────────────────────────────────────

describe("mapping helpers", () => {
	describe("mapItemStatus", () => {
		it("maps PUBLISHED to published", () => {
			expect(mapItemStatus("PUBLISHED")).toBe("published");
		});

		it("maps UNPUBLISHED to unpublished", () => {
			expect(mapItemStatus("UNPUBLISHED")).toBe("unpublished");
		});

		it("maps RETIRED to retired", () => {
			expect(mapItemStatus("RETIRED")).toBe("retired");
		});

		it("maps SYSTEM_PROBLEM to system-error", () => {
			expect(mapItemStatus("SYSTEM_PROBLEM")).toBe("system-error");
		});

		it("defaults to unpublished for unknown status", () => {
			expect(mapItemStatus("UNKNOWN")).toBe("unpublished");
		});
	});

	describe("mapFulfillmentType", () => {
		it("maps WFS to wfs", () => {
			expect(mapFulfillmentType("WFS")).toBe("wfs");
		});

		it("maps SELLER to seller", () => {
			expect(mapFulfillmentType("SELLER")).toBe("seller");
		});

		it("defaults to seller for undefined", () => {
			expect(mapFulfillmentType(undefined)).toBe("seller");
		});
	});

	describe("mapFeedStatus", () => {
		it("maps RECEIVED to pending", () => {
			expect(mapFeedStatus("RECEIVED")).toBe("pending");
		});

		it("maps INPROGRESS to processing", () => {
			expect(mapFeedStatus("INPROGRESS")).toBe("processing");
		});

		it("maps PROCESSED to completed", () => {
			expect(mapFeedStatus("PROCESSED")).toBe("completed");
		});

		it("maps ERROR to error", () => {
			expect(mapFeedStatus("ERROR")).toBe("error");
		});

		it("defaults to pending for unknown", () => {
			expect(mapFeedStatus("UNKNOWN")).toBe("pending");
		});
	});

	describe("mapOrderStatus", () => {
		it("maps Cancelled status", () => {
			expect(mapOrderStatus(["Cancelled"])).toBe("cancelled");
		});

		it("maps Shipped status", () => {
			expect(mapOrderStatus(["Shipped"])).toBe("shipped");
		});

		it("maps Acknowledged status", () => {
			expect(mapOrderStatus(["Acknowledged"])).toBe("acknowledged");
		});

		it("maps Delivered status", () => {
			expect(mapOrderStatus(["Delivered"])).toBe("delivered");
		});

		it("maps Refund status", () => {
			expect(mapOrderStatus(["Refund"])).toBe("refunded");
		});

		it("defaults to created for unknown", () => {
			expect(mapOrderStatus(["Created"])).toBe("created");
		});

		it("prioritizes Cancelled over Shipped", () => {
			expect(mapOrderStatus(["Shipped", "Cancelled"])).toBe("cancelled");
		});
	});

	describe("extractOrderTotals", () => {
		it("sums product and shipping charges", () => {
			const orderLines: WalmartApiOrderLine[] = [
				{
					lineNumber: "1",
					item: { productName: "Product A", sku: "SKU-A" },
					charges: {
						charge: [
							{
								chargeType: "PRODUCT",
								chargeAmount: { currency: "USD", amount: 29.99 },
								tax: {
									taxName: "Tax",
									taxAmount: { currency: "USD", amount: 2.5 },
								},
							},
							{
								chargeType: "SHIPPING",
								chargeAmount: { currency: "USD", amount: 5.99 },
							},
						],
					},
					orderLineQuantity: { unitOfMeasurement: "EACH", amount: "1" },
					statusDate: "2024-01-15T00:00:00Z",
					orderLineStatuses: {
						orderLineStatus: [
							{
								status: "Created",
								statusQuantity: {
									unitOfMeasurement: "EACH",
									amount: "1",
								},
							},
						],
					},
				},
			];

			const totals = extractOrderTotals(orderLines);
			expect(totals.orderTotal).toBeCloseTo(29.99);
			expect(totals.shippingTotal).toBeCloseTo(5.99);
			expect(totals.tax).toBeCloseTo(2.5);
		});

		it("handles multiple order lines", () => {
			const orderLines: WalmartApiOrderLine[] = [
				{
					lineNumber: "1",
					item: { productName: "A", sku: "A" },
					charges: {
						charge: [
							{
								chargeType: "PRODUCT",
								chargeAmount: { currency: "USD", amount: 10 },
							},
						],
					},
					orderLineQuantity: { unitOfMeasurement: "EACH", amount: "1" },
					statusDate: "2024-01-15T00:00:00Z",
					orderLineStatuses: {
						orderLineStatus: [
							{
								status: "Created",
								statusQuantity: {
									unitOfMeasurement: "EACH",
									amount: "1",
								},
							},
						],
					},
				},
				{
					lineNumber: "2",
					item: { productName: "B", sku: "B" },
					charges: {
						charge: [
							{
								chargeType: "PRODUCT",
								chargeAmount: { currency: "USD", amount: 20 },
							},
							{
								chargeType: "SHIPPING",
								chargeAmount: { currency: "USD", amount: 3 },
							},
						],
					},
					orderLineQuantity: { unitOfMeasurement: "EACH", amount: "2" },
					statusDate: "2024-01-15T00:00:00Z",
					orderLineStatuses: {
						orderLineStatus: [
							{
								status: "Created",
								statusQuantity: {
									unitOfMeasurement: "EACH",
									amount: "2",
								},
							},
						],
					},
				},
			];

			const totals = extractOrderTotals(orderLines);
			expect(totals.orderTotal).toBe(30);
			expect(totals.shippingTotal).toBe(3);
			expect(totals.tax).toBe(0);
		});
	});
});
