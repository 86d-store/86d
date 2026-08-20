import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	EbayProvider,
	mapConditionFromEbay,
	mapConditionToEbay,
	mapOrderStatus,
	parseEbayMoney,
} from "../provider";

// ── Realistic eBay API response fixtures ─────────────────────────────────────

const OAUTH_TOKEN_RESPONSE = {
	access_token: "v^1.1#i^1#p^3#r^1#I^3#f^0#t^H4sIAAAAAA...",
	expires_in: 7200,
	token_type: "User Access Token",
};

const CREATE_OFFER_RESPONSE = {
	offerId: "5014***",
	warnings: [],
};

const PUBLISH_OFFER_RESPONSE = {
	listingId: "110396***818",
	warnings: [],
};

const WITHDRAW_OFFER_RESPONSE = {
	listingId: "110396***818",
	warnings: [],
};

const GET_OFFERS_RESPONSE = {
	offers: [
		{
			offerId: "5014***",
			sku: "86d-abc12345",
			marketplaceId: "EBAY_US",
			format: "FIXED_PRICE",
			availableQuantity: 10,
			categoryId: "175673",
			listingDescription: "A premium widget for all your needs.",
			pricingSummary: {
				price: { value: "29.99", currency: "USD" },
			},
			status: "PUBLISHED",
			listing: { listingId: "110396***818" },
		},
	],
	total: 1,
};

const GET_ORDERS_RESPONSE = {
	orders: [
		{
			orderId: "12-34567-89012",
			creationDate: "2024-08-15T14:30:00Z",
			lastModifiedDate: "2024-08-16T09:00:00Z",
			orderFulfillmentStatus: "NOT_STARTED",
			orderPaymentStatus: "PAID",
			pricingSummary: {
				priceSubtotal: { value: "29.99", currency: "USD" },
				deliveryCost: { value: "5.99", currency: "USD" },
				total: { value: "35.98", currency: "USD" },
			},
			buyer: {
				username: "buyer_jane_2024",
				buyerRegistrationAddress: { fullName: "Jane Smith" },
			},
			fulfillmentStartInstructions: [
				{
					shippingStep: {
						shipTo: {
							fullName: "Jane Smith",
							contactAddress: {
								addressLine1: "456 Oak Avenue",
								addressLine2: "Apt 2B",
								city: "Austin",
								stateOrProvince: "TX",
								postalCode: "78701",
								countryCode: "US",
							},
						},
					},
				},
			],
			lineItems: [
				{
					lineItemId: "li-001",
					legacyItemId: "110396***818",
					title: "Premium Widget",
					quantity: 1,
					lineItemCost: { value: "29.99", currency: "USD" },
					sku: "86d-abc12345",
					lineItemFulfillmentStatus: "NOT_STARTED",
				},
			],
			cancelStatus: { cancelState: "NONE_REQUESTED" },
		},
		{
			orderId: "98-76543-21098",
			creationDate: "2024-08-14T10:00:00Z",
			lastModifiedDate: "2024-08-15T16:00:00Z",
			orderFulfillmentStatus: "FULFILLED",
			orderPaymentStatus: "PAID",
			pricingSummary: {
				priceSubtotal: { value: "49.99", currency: "USD" },
				deliveryCost: { value: "0.00", currency: "USD" },
				total: { value: "49.99", currency: "USD" },
			},
			buyer: {
				username: "techbuyer42",
				buyerRegistrationAddress: { fullName: "John Doe" },
			},
			lineItems: [
				{
					lineItemId: "li-002",
					legacyItemId: "110397***999",
					title: "Deluxe Gadget",
					quantity: 1,
					lineItemCost: { value: "49.99", currency: "USD" },
					lineItemFulfillmentStatus: "FULFILLED",
				},
			],
		},
	],
	total: 2,
	offset: 0,
	limit: 50,
};

const GET_SINGLE_ORDER_RESPONSE = GET_ORDERS_RESPONSE.orders[0];

const FULFILLMENT_RESPONSE = {
	fulfillmentId: "ful-9876543",
};

const EBAY_API_ERROR_RESPONSE = {
	errors: [
		{
			errorId: 25710,
			message: "We didn't find the resource you are looking for.",
			longMessage:
				"The item ID 000000000000 was not found. Check the ID and try again.",
		},
	],
};

const INVENTORY_ITEM_RESPONSE = {
	sku: "86d-abc12345",
	locale: "en_US",
	product: {
		title: "Premium Widget",
		description: "A premium widget for all your needs.",
		imageUrls: ["https://example.com/widget.jpg"],
		aspects: { Brand: ["WidgetCo"], Material: ["Aluminum"] },
	},
	condition: "NEW",
	availability: {
		shipToLocationAvailability: {
			quantity: 25,
		},
	},
};

// ── Provider tests ───────────────────────────────────────────────────────────

describe("EbayProvider", () => {
	let provider: EbayProvider;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		provider = new EbayProvider({
			clientId: "MyApp-Prod-abc123-def456",
			clientSecret: "PRD-abc123def456-7890-1234",
			refreshToken: "v^1.1#i^1#f^0#r^1#p^3#I^3...",
			siteId: "EBAY_US",
		});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	function mockFetchSequence(
		...responses: {
			ok: boolean;
			status: number;
			body: unknown;
		}[]
	) {
		const mock = vi.fn();
		for (const resp of responses) {
			mock.mockResolvedValueOnce({
				ok: resp.ok,
				status: resp.status,
				json: () => Promise.resolve(resp.body),
				text: () => Promise.resolve(resp.body ? JSON.stringify(resp.body) : ""),
			});
		}
		globalThis.fetch = mock;
		return mock;
	}

	function mockApiCall(apiResponse: unknown, status = 200) {
		return mockFetchSequence(
			{ ok: true, status: 200, body: OAUTH_TOKEN_RESPONSE },
			{
				ok: status >= 200 && status < 300,
				status,
				body: apiResponse,
			},
		);
	}

	// ── Authentication ──────────────────────────────────────────────────

	describe("authentication", () => {
		it("obtains OAuth2 access token via Basic auth before API calls", async () => {
			const mock = mockApiCall(GET_OFFERS_RESPONSE);

			await provider.getOffers("86d-abc12345");

			const tokenCall = mock.mock.calls[0];
			expect(tokenCall[0]).toBe(
				"https://api.ebay.com/identity/v1/oauth2/token",
			);
			expect(tokenCall[1]?.method).toBe("POST");
			expect(tokenCall[1]?.headers).toMatchObject({
				"Content-Type": "application/x-www-form-urlencoded",
			});

			const authHeader = tokenCall[1]?.headers?.Authorization as string;
			expect(authHeader).toMatch(/^Basic /);
			const decoded = atob(authHeader.replace("Basic ", ""));
			expect(decoded).toBe(
				"MyApp-Prod-abc123-def456:PRD-abc123def456-7890-1234",
			);

			const bodyStr = tokenCall[1]?.body as string;
			expect(bodyStr).toContain("grant_type=refresh_token");
		});

		it("sends Bearer token in Authorization header for API calls", async () => {
			const mock = mockApiCall(GET_OFFERS_RESPONSE);

			await provider.getOffers("86d-abc12345");

			const apiCall = mock.mock.calls[1];
			expect(apiCall[1]?.headers).toMatchObject({
				Authorization: "Bearer v^1.1#i^1#p^3#r^1#I^3#f^0#t^H4sIAAAAAA...",
				"X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
			});
		});

		it("caches token across multiple API calls", async () => {
			const mock = mockFetchSequence(
				{ ok: true, status: 200, body: OAUTH_TOKEN_RESPONSE },
				{ ok: true, status: 200, body: GET_OFFERS_RESPONSE },
				{
					ok: true,
					status: 200,
					body: INVENTORY_ITEM_RESPONSE,
				},
			);

			await provider.getOffers("86d-abc12345");
			await provider.getInventoryItem("86d-abc12345");

			expect(mock).toHaveBeenCalledTimes(3);
			expect(mock.mock.calls[0][0]).toContain("oauth2/token");
			expect(mock.mock.calls[1][0]).toContain("/sell/inventory/");
			expect(mock.mock.calls[2][0]).toContain("/sell/inventory/");
		});

		it("throws on OAuth token error", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				json: () => Promise.resolve({ error: "invalid_grant" }),
				text: () => Promise.resolve('{"error":"invalid_grant"}'),
			});

			await expect(provider.getOffers("test")).rejects.toThrow(
				"eBay OAuth token error",
			);
		});
	});

	// ── Inventory API ───────────────────────────────────────────────────

	describe("createOrUpdateInventoryItem", () => {
		it("sends PUT with correct body", async () => {
			const mock = mockFetchSequence(
				{ ok: true, status: 200, body: OAUTH_TOKEN_RESPONSE },
				{ ok: true, status: 204, body: null },
			);

			await provider.createOrUpdateInventoryItem("SKU-001", {
				title: "Premium Widget",
				description: "A great widget",
				condition: "new",
				quantity: 25,
				imageUrls: ["https://example.com/widget.jpg"],
			});

			const apiCall = mock.mock.calls[1];
			expect(apiCall[1]?.method).toBe("PUT");
			expect(apiCall[0] as string).toContain(
				"/sell/inventory/v1/inventory_item/SKU-001",
			);
			const body = JSON.parse(apiCall[1]?.body as string);
			expect(body.product.title).toBe("Premium Widget");
			expect(body.product.description).toBe("A great widget");
			expect(body.product.imageUrls).toEqual([
				"https://example.com/widget.jpg",
			]);
			expect(body.condition).toBe("NEW");
			expect(body.availability.shipToLocationAvailability.quantity).toBe(25);
		});

		it("maps condition correctly", async () => {
			const mock = mockFetchSequence(
				{ ok: true, status: 200, body: OAUTH_TOKEN_RESPONSE },
				{ ok: true, status: 204, body: null },
			);

			await provider.createOrUpdateInventoryItem("SKU-002", {
				title: "Used Widget",
				condition: "very-good",
				quantity: 1,
			});

			const body = JSON.parse(mock.mock.calls[1][1]?.body as string);
			expect(body.condition).toBe("USED_VERY_GOOD");
		});
	});

	describe("getInventoryItem", () => {
		it("returns inventory item", async () => {
			mockApiCall(INVENTORY_ITEM_RESPONSE);

			const result = await provider.getInventoryItem("86d-abc12345");

			expect(result).not.toBeNull();
			expect(result?.sku).toBe("86d-abc12345");
			expect(result?.product.title).toBe("Premium Widget");
			expect(result?.availability.shipToLocationAvailability.quantity).toBe(25);
		});

		it("returns null for 404", async () => {
			mockFetchSequence(
				{ ok: true, status: 200, body: OAUTH_TOKEN_RESPONSE },
				{
					ok: false,
					status: 404,
					body: {
						errors: [
							{
								errorId: 25710,
								message: "HTTP 404",
							},
						],
					},
				},
			);

			const result = await provider.getInventoryItem("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("deleteInventoryItem", () => {
		it("sends DELETE request", async () => {
			const mock = mockFetchSequence(
				{ ok: true, status: 200, body: OAUTH_TOKEN_RESPONSE },
				{ ok: true, status: 204, body: null },
			);

			await provider.deleteInventoryItem("SKU-001");

			const apiCall = mock.mock.calls[1];
			expect(apiCall[1]?.method).toBe("DELETE");
			expect(apiCall[0] as string).toContain(
				"/sell/inventory/v1/inventory_item/SKU-001",
			);
		});
	});

	// ── Offer API ────────────────────────────────────────────────────────

	describe("createOffer", () => {
		it("creates a fixed-price offer", async () => {
			const mock = mockApiCall(CREATE_OFFER_RESPONSE);

			const result = await provider.createOffer({
				sku: "86d-abc12345",
				price: 29.99,
				quantity: 10,
				format: "fixed-price",
				categoryId: "175673",
			});

			const apiCall = mock.mock.calls[1];
			expect(apiCall[1]?.method).toBe("POST");
			expect(apiCall[0] as string).toContain("/sell/inventory/v1/offer");
			const body = JSON.parse(apiCall[1]?.body as string);
			expect(body.sku).toBe("86d-abc12345");
			expect(body.format).toBe("FIXED_PRICE");
			expect(body.pricingSummary.price.value).toBe("29.99");
			expect(body.categoryId).toBe("175673");

			expect(result.offerId).toBe("5014***");
		});

		it("creates an auction offer with start price", async () => {
			const mock = mockApiCall(CREATE_OFFER_RESPONSE);

			await provider.createOffer({
				sku: "86d-xyz99999",
				price: 50,
				quantity: 1,
				format: "auction",
				auctionStartPrice: 9.99,
			});

			const body = JSON.parse(mock.mock.calls[1][1]?.body as string);
			expect(body.format).toBe("AUCTION");
			expect(body.pricingSummary.auctionStartPrice.value).toBe("9.99");
		});
	});

	describe("publishOffer", () => {
		it("publishes an offer and returns listing ID", async () => {
			const mock = mockApiCall(PUBLISH_OFFER_RESPONSE);

			const result = await provider.publishOffer("5014***");

			const url = mock.mock.calls[1][0] as string;
			expect(url).toContain("/sell/inventory/v1/offer/5014***/publish");
			expect(mock.mock.calls[1][1]?.method).toBe("POST");
			expect(result.listingId).toBe("110396***818");
		});
	});

	describe("withdrawOffer", () => {
		it("withdraws an offer (ends listing)", async () => {
			const mock = mockApiCall(WITHDRAW_OFFER_RESPONSE);

			const result = await provider.withdrawOffer("5014***");

			const url = mock.mock.calls[1][0] as string;
			expect(url).toContain("/sell/inventory/v1/offer/5014***/withdraw");
			expect(result.listingId).toBe("110396***818");
		});
	});

	describe("getOffers", () => {
		it("fetches offers for a SKU", async () => {
			const mock = mockApiCall(GET_OFFERS_RESPONSE);

			const result = await provider.getOffers("86d-abc12345");

			const url = mock.mock.calls[1][0] as string;
			expect(url).toContain("sku=86d-abc12345");
			expect(result).toHaveLength(1);
			expect(result[0].offerId).toBe("5014***");
			expect(result[0].format).toBe("FIXED_PRICE");
		});
	});

	describe("updateOffer", () => {
		it("updates offer price and quantity", async () => {
			const mock = mockFetchSequence(
				{ ok: true, status: 200, body: OAUTH_TOKEN_RESPONSE },
				{ ok: true, status: 204, body: null },
			);

			await provider.updateOffer("5014***", {
				price: 39.99,
				quantity: 5,
			});

			const apiCall = mock.mock.calls[1];
			expect(apiCall[1]?.method).toBe("PUT");
			const body = JSON.parse(apiCall[1]?.body as string);
			expect(body.pricingSummary.price.value).toBe("39.99");
			expect(body.availableQuantity).toBe(5);
		});
	});

	// ── Fulfillment API ──────────────────────────────────────────────────

	describe("getOrders", () => {
		it("fetches orders with filter", async () => {
			const mock = mockApiCall(GET_ORDERS_RESPONSE);

			const result = await provider.getOrders({
				limit: 50,
				filter: "creationdate:[2024-08-01T00:00:00Z..2024-08-31T23:59:59Z]",
			});

			const url = mock.mock.calls[1][0] as string;
			expect(url).toContain("/sell/fulfillment/v1/order");
			expect(url).toContain("limit=50");
			expect(url).toContain("filter=");

			expect(result.orders).toHaveLength(2);
			expect(result.orders[0].orderId).toBe("12-34567-89012");
			expect(result.orders[0].buyer.username).toBe("buyer_jane_2024");
			expect(result.total).toBe(2);
		});
	});

	describe("getOrder", () => {
		it("fetches a single order by ID", async () => {
			mockApiCall(GET_SINGLE_ORDER_RESPONSE);

			const result = await provider.getOrder("12-34567-89012");

			expect(result.orderId).toBe("12-34567-89012");
			expect(result.orderPaymentStatus).toBe("PAID");
			expect(result.lineItems).toHaveLength(1);
			expect(result.lineItems[0].title).toBe("Premium Widget");
		});
	});

	describe("createShippingFulfillment", () => {
		it("creates shipping fulfillment with tracking", async () => {
			const mock = mockApiCall(FULFILLMENT_RESPONSE);

			const fulfillmentId = await provider.createShippingFulfillment(
				"12-34567-89012",
				{
					trackingNumber: "1Z999AA10123456784",
					carrier: "UPS",
					lineItemIds: ["li-001"],
				},
			);

			const apiCall = mock.mock.calls[1];
			expect(apiCall[1]?.method).toBe("POST");
			const url = apiCall[0] as string;
			expect(url).toContain(
				"/sell/fulfillment/v1/order/12-34567-89012/shipping_fulfillment",
			);
			const body = JSON.parse(apiCall[1]?.body as string);
			expect(body.trackingNumber).toBe("1Z999AA10123456784");
			expect(body.shippingCarrierCode).toBe("UPS");
			expect(body.lineItems[0].lineItemId).toBe("li-001");

			expect(fulfillmentId).toBe("ful-9876543");
		});
	});

	// ── Error handling ──────────────────────────────────────────────────

	describe("error handling", () => {
		it("throws with message from eBay error response", async () => {
			mockApiCall(EBAY_API_ERROR_RESPONSE, 404);

			await expect(provider.getOffers("bad-sku")).rejects.toThrow(
				"eBay API error: We didn't find the resource you are looking for.",
			);
		});

		it("throws with HTTP status when error body is unparseable", async () => {
			mockFetchSequence(
				{ ok: true, status: 200, body: OAUTH_TOKEN_RESPONSE },
				{ ok: false, status: 500, body: null },
			);

			await expect(provider.getOffers("test")).rejects.toThrow(
				"eBay API error: HTTP 500",
			);
		});
	});

	// ── Sandbox mode ────────────────────────────────────────────────────

	describe("sandbox mode", () => {
		it("uses sandbox URLs when sandbox enabled", async () => {
			const sandboxProvider = new EbayProvider({
				clientId: "client-id",
				clientSecret: "client-secret",
				refreshToken: "refresh-token",
				sandbox: true,
			});

			const mock = mockApiCall(GET_OFFERS_RESPONSE);
			await sandboxProvider.getOffers("test");

			const tokenUrl = mock.mock.calls[0][0] as string;
			expect(tokenUrl).toBe(
				"https://api.sandbox.ebay.com/identity/v1/oauth2/token",
			);
			const apiUrl = mock.mock.calls[1][0] as string;
			expect(apiUrl).toContain("api.sandbox.ebay.com");
		});
	});
});

// ── Mapping helper tests ─────────────────────────────────────────────────────

describe("mapOrderStatus", () => {
	it("maps paid + not started to paid", () => {
		expect(mapOrderStatus("NOT_STARTED", "PAID")).toBe("paid");
	});
	it("maps fulfilled to shipped", () => {
		expect(mapOrderStatus("FULFILLED", "PAID")).toBe("shipped");
	});
	it("maps pending payment to pending", () => {
		expect(mapOrderStatus("NOT_STARTED", "PENDING")).toBe("pending");
	});
	it("maps fully refunded to returned", () => {
		expect(mapOrderStatus("NOT_STARTED", "FULLY_REFUNDED")).toBe("returned");
	});
	it("maps cancel closed to cancelled", () => {
		expect(mapOrderStatus("NOT_STARTED", "PAID", "CANCEL_CLOSED")).toBe(
			"cancelled",
		);
	});
	it("cancel takes precedence over fulfillment", () => {
		expect(mapOrderStatus("FULFILLED", "PAID", "CANCEL_CLOSED")).toBe(
			"cancelled",
		);
	});
});

describe("mapConditionToEbay", () => {
	it("maps new to NEW", () => {
		expect(mapConditionToEbay("new")).toBe("NEW");
	});
	it("maps like-new to LIKE_NEW", () => {
		expect(mapConditionToEbay("like-new")).toBe("LIKE_NEW");
	});
	it("maps very-good to USED_VERY_GOOD", () => {
		expect(mapConditionToEbay("very-good")).toBe("USED_VERY_GOOD");
	});
	it("maps good to USED_GOOD", () => {
		expect(mapConditionToEbay("good")).toBe("USED_GOOD");
	});
	it("maps acceptable to USED_ACCEPTABLE", () => {
		expect(mapConditionToEbay("acceptable")).toBe("USED_ACCEPTABLE");
	});
	it("maps for-parts to FOR_PARTS_OR_NOT_WORKING", () => {
		expect(mapConditionToEbay("for-parts")).toBe("FOR_PARTS_OR_NOT_WORKING");
	});
});

describe("mapConditionFromEbay", () => {
	it("maps NEW to new", () => {
		expect(mapConditionFromEbay("NEW")).toBe("new");
	});
	it("maps USED_VERY_GOOD to very-good", () => {
		expect(mapConditionFromEbay("USED_VERY_GOOD")).toBe("very-good");
	});
	it("maps unknown condition to new", () => {
		expect(mapConditionFromEbay("SOME_UNKNOWN")).toBe("new");
	});
});

describe("parseEbayMoney", () => {
	it("parses valid amount", () => {
		expect(parseEbayMoney({ value: "29.99" })).toBe(29.99);
	});
	it("returns 0 for undefined", () => {
		expect(parseEbayMoney(undefined)).toBe(0);
	});
	it("returns 0 for empty value", () => {
		expect(parseEbayMoney({ value: "" })).toBe(0);
	});
	it("returns 0 for non-numeric value", () => {
		expect(parseEbayMoney({ value: "not-a-number" })).toBe(0);
	});
});
