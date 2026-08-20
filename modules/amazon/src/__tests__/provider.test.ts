import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	AmazonProvider,
	mapFulfillmentChannel,
	mapOrderStatus,
	parseSpApiMoney,
} from "../provider";

// ── Realistic SP-API response fixtures ──────────────────────────────────────

const LWA_TOKEN_RESPONSE = {
	access_token: "Atza|IQEBLjAsAhRmHjNgHpi0U-Dme37rR6CuUpSR",
	token_type: "bearer",
	expires_in: 3600,
	refresh_token: "Atzr|IQEBLzAtAhRPpMJxdwVz2Nn6f2y-tpJX2De",
};

const SEARCH_LISTINGS_RESPONSE = {
	numberOfResults: 2,
	pagination: { nextToken: "token-page-2" },
	items: [
		{
			sku: "SKU-001",
			summaries: [
				{
					marketplaceId: "ATVPDKIKX0DER",
					asin: "B08N5WRWNW",
					productType: "PRODUCT",
					conditionType: "new_new",
					status: ["BUYABLE"],
					itemName: "Premium Widget",
					createdDate: "2024-01-15T10:30:00Z",
					lastUpdatedDate: "2024-06-01T14:22:00Z",
					mainImage: {
						link: "https://m.media-amazon.com/images/I/widget.jpg",
						height: 500,
						width: 500,
					},
				},
			],
			offers: [
				{
					marketplaceId: "ATVPDKIKX0DER",
					offerType: "B2C",
					price: { currencyCode: "USD", amount: "29.99" },
				},
			],
			fulfillmentAvailability: [
				{ fulfillmentChannelCode: "DEFAULT", quantity: 150 },
			],
			issues: [],
		},
		{
			sku: "SKU-002",
			summaries: [
				{
					marketplaceId: "ATVPDKIKX0DER",
					asin: "B09K3LRXYZ",
					productType: "PRODUCT",
					status: ["BUYABLE", "DISCOVERABLE"],
					itemName: "Deluxe Gadget",
					createdDate: "2024-03-10T08:00:00Z",
					lastUpdatedDate: "2024-05-20T11:15:00Z",
				},
			],
			offers: [
				{
					marketplaceId: "ATVPDKIKX0DER",
					offerType: "B2C",
					price: { currencyCode: "USD", amount: "49.99" },
				},
			],
			fulfillmentAvailability: [
				{ fulfillmentChannelCode: "AMAZON_NA", quantity: 75 },
			],
			issues: [],
		},
	],
};

const GET_LISTING_RESPONSE = {
	sku: "SKU-001",
	summaries: [
		{
			marketplaceId: "ATVPDKIKX0DER",
			asin: "B08N5WRWNW",
			productType: "PRODUCT",
			conditionType: "new_new",
			status: ["BUYABLE"],
			itemName: "Premium Widget",
			createdDate: "2024-01-15T10:30:00Z",
			lastUpdatedDate: "2024-06-01T14:22:00Z",
		},
	],
	offers: [
		{
			marketplaceId: "ATVPDKIKX0DER",
			offerType: "B2C",
			price: { currencyCode: "USD", amount: "29.99" },
		},
	],
	fulfillmentAvailability: [
		{ fulfillmentChannelCode: "DEFAULT", quantity: 150 },
	],
	issues: [],
};

const PUT_LISTING_RESPONSE = {
	sku: "SKU-003",
	status: "ACCEPTED",
	submissionId: "sub-12345-abcde",
	identifiers: [{ marketplaceId: "ATVPDKIKX0DER", asin: "B0CNEWPROD1" }],
	issues: [],
};

const PUT_LISTING_WITH_ERRORS_RESPONSE = {
	sku: "SKU-004",
	status: "INVALID",
	submissionId: "sub-67890-fghij",
	identifiers: [],
	issues: [
		{
			code: "MISSING_REQUIRED_ATTRIBUTE",
			message: "item_name is required",
			severity: "ERROR",
			attributeNames: ["item_name"],
		},
		{
			code: "LOW_IMAGE_QUALITY",
			message: "Image resolution is below minimum",
			severity: "WARNING",
		},
	],
};

const GET_ORDERS_RESPONSE = {
	payload: {
		Orders: [
			{
				AmazonOrderId: "111-2222222-3333333",
				PurchaseDate: "2024-06-15T09:30:00Z",
				LastUpdateDate: "2024-06-15T10:00:00Z",
				OrderStatus: "Unshipped",
				FulfillmentChannel: "MFN",
				NumberOfItemsShipped: 0,
				NumberOfItemsUnshipped: 2,
				OrderTotal: { CurrencyCode: "USD", Amount: "59.98" },
				ShippingAddress: {
					Name: "Jane Doe",
					AddressLine1: "123 Main St",
					City: "Seattle",
					StateOrRegion: "WA",
					PostalCode: "98101",
					CountryCode: "US",
				},
				BuyerInfo: { BuyerName: "Jane Doe" },
				IsBusinessOrder: false,
				IsPrime: true,
			},
			{
				AmazonOrderId: "444-5555555-6666666",
				PurchaseDate: "2024-06-14T15:00:00Z",
				LastUpdateDate: "2024-06-16T08:00:00Z",
				OrderStatus: "Shipped",
				FulfillmentChannel: "AFN",
				NumberOfItemsShipped: 1,
				NumberOfItemsUnshipped: 0,
				OrderTotal: { CurrencyCode: "USD", Amount: "29.99" },
				BuyerInfo: { BuyerName: "John Smith" },
				IsBusinessOrder: true,
				IsPrime: false,
			},
		],
		NextToken: "next-page-token-abc",
	},
};

const GET_ORDER_ITEMS_RESPONSE = {
	payload: {
		AmazonOrderId: "111-2222222-3333333",
		OrderItems: [
			{
				ASIN: "B08N5WRWNW",
				OrderItemId: "item-001",
				SellerSKU: "SKU-001",
				Title: "Premium Widget",
				QuantityOrdered: 2,
				QuantityShipped: 0,
				ItemPrice: { CurrencyCode: "USD", Amount: "49.98" },
				ItemTax: { CurrencyCode: "USD", Amount: "4.50" },
				ShippingPrice: { CurrencyCode: "USD", Amount: "5.99" },
			},
			{
				ASIN: "B09K3LRXYZ",
				OrderItemId: "item-002",
				SellerSKU: "SKU-002",
				Title: "Deluxe Gadget",
				QuantityOrdered: 1,
				QuantityShipped: 0,
				ItemPrice: { CurrencyCode: "USD", Amount: "10.00" },
				ItemTax: { CurrencyCode: "USD", Amount: "0.90" },
				ShippingPrice: { CurrencyCode: "USD", Amount: "0.00" },
			},
		],
	},
};

const SP_API_ERROR_RESPONSE = {
	errors: [
		{
			code: "InvalidInput",
			message: "The request was not valid for the specified resource.",
			details: "Field 'sku' must not be empty.",
		},
	],
};

// ── Provider tests ──────────────────────────────────────────────────────────

describe("AmazonProvider", () => {
	let provider: AmazonProvider;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		provider = new AmazonProvider({
			sellerId: "A1SELLER123",
			marketplaceId: "ATVPDKIKX0DER",
			clientId: "amzn1.application-oa2-client.abc123",
			clientSecret: "client-secret-xyz",
			refreshToken: "Atzr|refresh-token-abc",
			region: "NA",
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
				text: () => Promise.resolve(JSON.stringify(resp.body)),
			});
		}
		globalThis.fetch = mock;
		return mock;
	}

	/** Helper: mock token + one API call */
	function mockApiCall(apiResponse: unknown, status = 200) {
		return mockFetchSequence(
			{ ok: true, status: 200, body: LWA_TOKEN_RESPONSE },
			{ ok: status >= 200 && status < 300, status, body: apiResponse },
		);
	}

	// ── Authentication ──────────────────────────────────────────────────

	describe("authentication", () => {
		it("obtains LWA access token before API calls", async () => {
			const mock = mockApiCall(SEARCH_LISTINGS_RESPONSE);

			await provider.searchListings();

			// First call should be to LWA token endpoint
			const tokenCall = mock.mock.calls[0];
			expect(tokenCall[0]).toBe("https://api.amazon.com/auth/o2/token");
			expect(tokenCall[1]?.method).toBe("POST");
			expect(tokenCall[1]?.headers).toMatchObject({
				"Content-Type": "application/x-www-form-urlencoded",
			});

			const bodyStr = tokenCall[1]?.body as string;
			expect(bodyStr).toContain("grant_type=refresh_token");
			expect(bodyStr).toContain(
				"client_id=amzn1.application-oa2-client.abc123",
			);
			expect(bodyStr).toContain("client_secret=client-secret-xyz");
		});

		it("sends access token in x-amz-access-token header", async () => {
			const mock = mockApiCall(SEARCH_LISTINGS_RESPONSE);

			await provider.searchListings();

			const apiCall = mock.mock.calls[1];
			expect(apiCall[1]?.headers).toMatchObject({
				"x-amz-access-token": "Atza|IQEBLjAsAhRmHjNgHpi0U-Dme37rR6CuUpSR",
				"user-agent": "86d-Commerce/1.0 (Language=TypeScript)",
			});
		});

		it("caches token across multiple API calls", async () => {
			const mock = mockFetchSequence(
				{ ok: true, status: 200, body: LWA_TOKEN_RESPONSE },
				{ ok: true, status: 200, body: SEARCH_LISTINGS_RESPONSE },
				{ ok: true, status: 200, body: GET_LISTING_RESPONSE },
			);

			await provider.searchListings();
			await provider.getListing("SKU-001");

			// Only one token call
			expect(mock).toHaveBeenCalledTimes(3);
			expect(mock.mock.calls[0][0]).toBe(
				"https://api.amazon.com/auth/o2/token",
			);
			// Calls 2 and 3 are API calls, not token refreshes
			expect(mock.mock.calls[1][0]).toContain("/listings/");
			expect(mock.mock.calls[2][0]).toContain("/listings/");
		});

		it("throws on LWA token error", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				json: () => Promise.resolve({ error: "invalid_grant" }),
				text: () => Promise.resolve('{"error":"invalid_grant"}'),
			});

			await expect(provider.searchListings()).rejects.toThrow(
				"Amazon LWA token error",
			);
		});
	});

	// ── Listings Items API ──────────────────────────────────────────────

	describe("searchListings", () => {
		it("calls correct endpoint with marketplace ID", async () => {
			const mock = mockApiCall(SEARCH_LISTINGS_RESPONSE);

			const result = await provider.searchListings();

			const apiCall = mock.mock.calls[1];
			const url = apiCall[0] as string;
			expect(url).toContain(
				"sellingpartnerapi-na.amazon.com/listings/2021-08-01/items/A1SELLER123",
			);
			expect(url).toContain("marketplaceIds=ATVPDKIKX0DER");
			expect(url).toContain("includedData=summaries");
			expect(apiCall[1]?.method).toBe("GET");

			expect(result.numberOfResults).toBe(2);
			expect(result.items).toHaveLength(2);
			expect(result.items[0].sku).toBe("SKU-001");
			expect(result.items[0].summaries?.[0].asin).toBe("B08N5WRWNW");
			expect(result.pagination.nextToken).toBe("token-page-2");
		});

		it("passes pagination params", async () => {
			const mock = mockApiCall(SEARCH_LISTINGS_RESPONSE);

			await provider.searchListings({
				pageSize: 10,
				pageToken: "abc-token",
			});

			const url = mock.mock.calls[1][0] as string;
			expect(url).toContain("pageSize=10");
			expect(url).toContain("pageToken=abc-token");
		});
	});

	describe("getListing", () => {
		it("fetches a listing by SKU", async () => {
			const mock = mockApiCall(GET_LISTING_RESPONSE);

			const result = await provider.getListing("SKU-001");

			const url = mock.mock.calls[1][0] as string;
			expect(url).toContain("/items/A1SELLER123/SKU-001");
			expect(result.sku).toBe("SKU-001");
			expect(result.fulfillmentAvailability?.[0].quantity).toBe(150);
		});

		it("URL-encodes SKU with special characters", async () => {
			const mock = mockApiCall(GET_LISTING_RESPONSE);

			await provider.getListing("SKU/WITH SPACES");

			const url = mock.mock.calls[1][0] as string;
			expect(url).toContain("SKU%2FWITH%20SPACES");
		});
	});

	describe("putListing", () => {
		it("creates a listing with correct request body", async () => {
			const mock = mockApiCall(PUT_LISTING_RESPONSE);

			const result = await provider.putListing("SKU-003", "PRODUCT", {
				item_name: [
					{
						value: "New Product",
						marketplace_id: "ATVPDKIKX0DER",
					},
				],
			});

			const apiCall = mock.mock.calls[1];
			expect(apiCall[1]?.method).toBe("PUT");
			const body = JSON.parse(apiCall[1]?.body as string);
			expect(body.productType).toBe("PRODUCT");
			expect(body.requirements).toBe("LISTING");
			expect(body.attributes.item_name[0].value).toBe("New Product");

			expect(result.status).toBe("ACCEPTED");
			expect(result.submissionId).toBe("sub-12345-abcde");
			expect(result.identifiers?.[0].asin).toBe("B0CNEWPROD1");
		});

		it("returns issues when listing is invalid", async () => {
			mockApiCall(PUT_LISTING_WITH_ERRORS_RESPONSE);

			const result = await provider.putListing("SKU-004", "PRODUCT", {});

			expect(result.status).toBe("INVALID");
			expect(result.issues).toHaveLength(2);
			expect(result.issues?.[0].severity).toBe("ERROR");
			expect(result.issues?.[0].code).toBe("MISSING_REQUIRED_ATTRIBUTE");
		});
	});

	describe("patchListing", () => {
		it("sends patch operations", async () => {
			const mock = mockApiCall(PUT_LISTING_RESPONSE);

			await provider.patchListing("SKU-001", "PRODUCT", [
				{
					op: "replace",
					path: "/attributes/item_name",
					value: [
						{
							value: "Updated Name",
							marketplace_id: "ATVPDKIKX0DER",
						},
					],
				},
			]);

			const body = JSON.parse(mock.mock.calls[1][1]?.body as string);
			expect(body.productType).toBe("PRODUCT");
			expect(body.patches).toHaveLength(1);
			expect(body.patches[0].op).toBe("replace");
		});
	});

	describe("deleteListing", () => {
		it("sends DELETE request for SKU", async () => {
			const mock = mockApiCall(PUT_LISTING_RESPONSE);

			await provider.deleteListing("SKU-001");

			const apiCall = mock.mock.calls[1];
			expect(apiCall[1]?.method).toBe("DELETE");
			expect(apiCall[0] as string).toContain("/items/A1SELLER123/SKU-001");
		});
	});

	// ── Orders API ──────────────────────────────────────────────────────

	describe("getOrders", () => {
		it("fetches orders with marketplace and date filter", async () => {
			const mock = mockApiCall(GET_ORDERS_RESPONSE);

			const result = await provider.getOrders({
				createdAfter: "2024-06-01T00:00:00Z",
			});

			const url = mock.mock.calls[1][0] as string;
			expect(url).toContain("MarketplaceIds=ATVPDKIKX0DER");
			expect(url).toContain("CreatedAfter=2024-06-01T00%3A00%3A00Z");

			expect(result.Orders).toHaveLength(2);
			expect(result.Orders[0].AmazonOrderId).toBe("111-2222222-3333333");
			expect(result.Orders[0].OrderTotal?.Amount).toBe("59.98");
			expect(result.NextToken).toBe("next-page-token-abc");
		});

		it("passes order status filter", async () => {
			const mock = mockApiCall(GET_ORDERS_RESPONSE);

			await provider.getOrders({
				orderStatuses: ["Unshipped", "PartiallyShipped"],
			});

			const url = mock.mock.calls[1][0] as string;
			expect(url).toContain("OrderStatuses=Unshipped%2CPartiallyShipped");
		});
	});

	describe("getOrder", () => {
		it("fetches a specific order by ID", async () => {
			const singleOrderResponse = {
				payload: GET_ORDERS_RESPONSE.payload.Orders[0],
			};
			const mock = mockApiCall(singleOrderResponse);

			const result = await provider.getOrder("111-2222222-3333333");

			const url = mock.mock.calls[1][0] as string;
			expect(url).toContain("/orders/v0/orders/111-2222222-3333333");
			expect(result.AmazonOrderId).toBe("111-2222222-3333333");
			expect(result.ShippingAddress?.City).toBe("Seattle");
		});
	});

	describe("getOrderItems", () => {
		it("fetches order items", async () => {
			const mock = mockApiCall(GET_ORDER_ITEMS_RESPONSE);

			const items = await provider.getOrderItems("111-2222222-3333333");

			const url = mock.mock.calls[1][0] as string;
			expect(url).toContain("/orders/v0/orders/111-2222222-3333333/orderItems");
			expect(items).toHaveLength(2);
			expect(items[0].ASIN).toBe("B08N5WRWNW");
			expect(items[0].SellerSKU).toBe("SKU-001");
			expect(items[0].QuantityOrdered).toBe(2);
			expect(items[0].ItemPrice?.Amount).toBe("49.98");
		});
	});

	describe("confirmShipment", () => {
		it("sends shipment confirmation", async () => {
			const mock = mockFetchSequence(
				{ ok: true, status: 200, body: LWA_TOKEN_RESPONSE },
				{ ok: true, status: 204, body: undefined },
			);

			await provider.confirmShipment("111-2222222-3333333", {
				trackingNumber: "1Z999AA10123456784",
				carrierCode: "UPS",
			});

			const apiCall = mock.mock.calls[1];
			expect(apiCall[1]?.method).toBe("POST");
			const url = apiCall[0] as string;
			expect(url).toContain("/orders/v0/orders/111-2222222-3333333/shipment");
			const body = JSON.parse(apiCall[1]?.body as string);
			expect(body.marketplaceId).toBe("ATVPDKIKX0DER");
			expect(body.packageDetail.trackingNumber).toBe("1Z999AA10123456784");
			expect(body.packageDetail.carrierCode).toBe("UPS");
		});
	});

	// ── Error handling ──────────────────────────────────────────────────

	describe("error handling", () => {
		it("throws with error message from SP-API error response", async () => {
			mockApiCall(SP_API_ERROR_RESPONSE, 400);

			await expect(provider.searchListings()).rejects.toThrow(
				"Amazon SP-API error: The request was not valid for the specified resource.",
			);
		});

		it("throws with HTTP status when error body is unparseable", async () => {
			mockFetchSequence(
				{ ok: true, status: 200, body: LWA_TOKEN_RESPONSE },
				{ ok: false, status: 500, body: null },
			);

			await expect(provider.searchListings()).rejects.toThrow(
				"Amazon SP-API error: HTTP 500",
			);
		});
	});

	// ── Regional endpoints ──────────────────────────────────────────────

	describe("regional endpoints", () => {
		it("uses EU endpoint for EU region", async () => {
			const euProvider = new AmazonProvider({
				sellerId: "A1SELLER123",
				marketplaceId: "A1PA6795UKMFR9",
				clientId: "client-id",
				clientSecret: "client-secret",
				refreshToken: "refresh-token",
				region: "EU",
			});

			const mock = mockApiCall(SEARCH_LISTINGS_RESPONSE);
			await euProvider.searchListings();

			const url = mock.mock.calls[1][0] as string;
			expect(url).toContain("sellingpartnerapi-eu.amazon.com");
		});

		it("uses FE endpoint for FE region", async () => {
			const feProvider = new AmazonProvider({
				sellerId: "A1SELLER123",
				marketplaceId: "A1VC38T7YXB528",
				clientId: "client-id",
				clientSecret: "client-secret",
				refreshToken: "refresh-token",
				region: "FE",
			});

			const mock = mockApiCall(SEARCH_LISTINGS_RESPONSE);
			await feProvider.searchListings();

			const url = mock.mock.calls[1][0] as string;
			expect(url).toContain("sellingpartnerapi-fe.amazon.com");
		});

		it("defaults to NA endpoint", async () => {
			const defaultProvider = new AmazonProvider({
				sellerId: "A1SELLER123",
				marketplaceId: "ATVPDKIKX0DER",
				clientId: "client-id",
				clientSecret: "client-secret",
				refreshToken: "refresh-token",
			});

			const mock = mockApiCall(SEARCH_LISTINGS_RESPONSE);
			await defaultProvider.searchListings();

			const url = mock.mock.calls[1][0] as string;
			expect(url).toContain("sellingpartnerapi-na.amazon.com");
		});
	});
});

// ── Mapping helper tests ────────────────────────────────────────────────────

describe("mapOrderStatus", () => {
	it("maps Pending to pending", () => {
		expect(mapOrderStatus("Pending")).toBe("pending");
	});
	it("maps PendingAvailability to pending", () => {
		expect(mapOrderStatus("PendingAvailability")).toBe("pending");
	});
	it("maps Unshipped to unshipped", () => {
		expect(mapOrderStatus("Unshipped")).toBe("unshipped");
	});
	it("maps PartiallyShipped to unshipped", () => {
		expect(mapOrderStatus("PartiallyShipped")).toBe("unshipped");
	});
	it("maps Shipped to shipped", () => {
		expect(mapOrderStatus("Shipped")).toBe("shipped");
	});
	it("maps Canceled to cancelled", () => {
		expect(mapOrderStatus("Canceled")).toBe("cancelled");
	});
	it("maps Unfulfillable to returned", () => {
		expect(mapOrderStatus("Unfulfillable")).toBe("returned");
	});
	it("maps unknown status to pending", () => {
		expect(mapOrderStatus("SomeNewStatus")).toBe("pending");
	});
});

describe("mapFulfillmentChannel", () => {
	it("maps AFN to FBA", () => {
		expect(mapFulfillmentChannel("AFN")).toBe("FBA");
	});
	it("maps MFN to FBM", () => {
		expect(mapFulfillmentChannel("MFN")).toBe("FBM");
	});
	it("maps unknown to FBM", () => {
		expect(mapFulfillmentChannel("OTHER")).toBe("FBM");
	});
});

describe("parseSpApiMoney", () => {
	it("parses valid amount", () => {
		expect(parseSpApiMoney({ Amount: "29.99" })).toBe(29.99);
	});
	it("returns 0 for undefined", () => {
		expect(parseSpApiMoney(undefined)).toBe(0);
	});
	it("returns 0 for empty amount", () => {
		expect(parseSpApiMoney({ Amount: "" })).toBe(0);
	});
	it("returns 0 for non-numeric amount", () => {
		expect(parseSpApiMoney({ Amount: "not-a-number" })).toBe(0);
	});
});
