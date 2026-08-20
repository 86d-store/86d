import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	MetaInstagramProvider,
	mapMetaOrderStatus,
	parseMetaMoney,
} from "../provider";

// ── Realistic Meta Graph API response fixtures ──────────────────────────────

const CREATE_PRODUCT_RESPONSE = {
	id: "4857392018273645",
};

const UPDATE_PRODUCT_RESPONSE = {
	success: true,
};

const DELETE_PRODUCT_RESPONSE = {
	success: true,
};

const GET_PRODUCT_RESPONSE = {
	id: "4857392018273645",
	retailer_id: "SKU-RING-001",
	name: "Gold Statement Ring",
	description: "Handcrafted 14k gold statement ring",
	availability: "in stock",
	price: "8999",
	currency: "USD",
	image_url: "https://cdn.example.com/images/ring-001.jpg",
	url: "https://example.com/products/ring-001",
	brand: "ArtisanJewels",
	inventory: 25,
	visibility: "published",
};

const LIST_PRODUCTS_RESPONSE = {
	data: [
		{
			id: "4857392018273645",
			retailer_id: "SKU-RING-001",
			name: "Gold Statement Ring",
			description: "Handcrafted gold ring",
			availability: "in stock",
			price: "8999",
			currency: "USD",
			image_url: "https://cdn.example.com/images/ring-001.jpg",
			brand: "ArtisanJewels",
			inventory: 25,
			visibility: "published",
		},
		{
			id: "5928403129384756",
			retailer_id: "SKU-NECK-002",
			name: "Silver Chain Necklace",
			description: "Sterling silver chain necklace",
			availability: "in stock",
			price: "4500",
			currency: "USD",
			image_url: "https://cdn.example.com/images/necklace-002.jpg",
			brand: "ArtisanJewels",
			inventory: 40,
			visibility: "published",
		},
	],
	paging: {
		cursors: {
			before: "QVFIUnh5ZA",
			after: "QVFIUmhkZA",
		},
		next: "https://graph.facebook.com/v19.0/123456789/products?after=QVFIUmhkZA",
	},
};

const LIST_ORDERS_RESPONSE = {
	data: [
		{
			id: "1234567890123456",
			order_status: {
				state: "IN_PROGRESS",
			},
			created: "2024-06-15T09:30:00+0000",
			last_updated: "2024-06-15T10:00:00+0000",
			items: {
				data: [
					{
						id: "item-001",
						product_id: "4857392018273645",
						retailer_id: "SKU-RING-001",
						quantity: 1,
						price_per_unit: { amount: "8999", currency: "USD" },
					},
				],
			},
			buyer_details: {
				name: "Sarah Chen",
				email: "sarah@example.com",
			},
			shipping_address: {
				street1: "456 Oak Avenue",
				city: "Portland",
				state: "OR",
				postal_code: "97201",
				country: "US",
				name: "Sarah Chen",
			},
			estimated_payment_details: {
				subtotal: { amount: "8999", currency: "USD" },
				tax: { amount: "810", currency: "USD" },
				total_amount: { amount: "10308", currency: "USD" },
				shipping: { amount: "499", currency: "USD" },
			},
			channel: "instagram",
		},
	],
};

const GET_ORDER_RESPONSE = {
	id: "1234567890123456",
	order_status: {
		state: "IN_PROGRESS",
	},
	created: "2024-06-15T09:30:00+0000",
	last_updated: "2024-06-15T10:00:00+0000",
	items: {
		data: [
			{
				id: "item-001",
				product_id: "4857392018273645",
				retailer_id: "SKU-RING-001",
				quantity: 1,
				price_per_unit: { amount: "8999", currency: "USD" },
			},
		],
	},
	buyer_details: {
		name: "Sarah Chen",
	},
	shipping_address: {
		street1: "456 Oak Avenue",
		city: "Portland",
		state: "OR",
		postal_code: "97201",
		country: "US",
	},
	estimated_payment_details: {
		subtotal: { amount: "8999", currency: "USD" },
		tax: { amount: "810", currency: "USD" },
		total_amount: { amount: "10308", currency: "USD" },
		shipping: { amount: "499", currency: "USD" },
	},
};

const CREATE_SHIPMENT_RESPONSE = {
	success: true,
};

const META_ERROR_RESPONSE = {
	error: {
		message: "(#100) Missing required parameter: name",
		type: "OAuthException",
		code: 100,
		fbtrace_id: "AcWbP8eNTKp6Qx9kR2mZ4aX",
	},
};

// ── Provider tests ──────────────────────────────────────────────────────────

describe("MetaInstagramProvider", () => {
	let provider: MetaInstagramProvider;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		provider = new MetaInstagramProvider({
			accessToken: "IGQVJWbzlUaWRkSEhPNnJfX3B5ZA",
			catalogId: "123456789012345",
			commerceAccountId: "987654321098765",
			businessId: "111222333444555",
		});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	function mockFetch(response: unknown, status = 200) {
		const mock = vi.fn().mockResolvedValue({
			ok: status >= 200 && status < 300,
			status,
			json: () => Promise.resolve(response),
		});
		globalThis.fetch = mock;
		return mock;
	}

	// ── Product operations ──────────────────────────────────────────────

	describe("createProduct", () => {
		it("calls correct endpoint with catalog ID", async () => {
			const mock = mockFetch(CREATE_PRODUCT_RESPONSE);

			const result = await provider.createProduct({
				retailer_id: "SKU-RING-001",
				name: "Gold Statement Ring",
				price: 89.99,
				image_url: "https://cdn.example.com/images/ring.jpg",
				brand: "ArtisanJewels",
			});

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain(
				"graph.facebook.com/v19.0/123456789012345/products",
			);
			expect(url).toContain("access_token=IGQVJWbzlUaWRkSEhPNnJfX3B5ZA");

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.retailer_id).toBe("SKU-RING-001");
			expect(body.name).toBe("Gold Statement Ring");
			expect(body.price).toBe("8999");
			expect(body.currency).toBe("USD");

			expect(result.id).toBe("4857392018273645");
		});

		it("converts price to cents", async () => {
			const mock = mockFetch(CREATE_PRODUCT_RESPONSE);

			await provider.createProduct({
				retailer_id: "SKU-001",
				name: "Test",
				price: 49.99,
				image_url: "https://example.com/img.jpg",
			});

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.price).toBe("4999");
		});
	});

	describe("updateProduct", () => {
		it("sends POST to product ID with partial fields", async () => {
			const mock = mockFetch(UPDATE_PRODUCT_RESPONSE);

			const result = await provider.updateProduct("4857392018273645", {
				name: "Updated Ring",
				price: 94.99,
			});

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("graph.facebook.com/v19.0/4857392018273645");

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.name).toBe("Updated Ring");
			expect(body.price).toBe("9499");
			expect(result.success).toBe(true);
		});
	});

	describe("deleteProduct", () => {
		it("sends DELETE request", async () => {
			const mock = mockFetch(DELETE_PRODUCT_RESPONSE);

			const result = await provider.deleteProduct("4857392018273645");

			expect(mock.mock.calls[0][1].method).toBe("DELETE");
			expect(result.success).toBe(true);
		});
	});

	describe("listProducts", () => {
		it("calls catalog products endpoint", async () => {
			const mock = mockFetch(LIST_PRODUCTS_RESPONSE);

			const result = await provider.listProducts();

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain(
				"graph.facebook.com/v19.0/123456789012345/products",
			);
			expect(mock.mock.calls[0][1].method).toBe("GET");

			expect(result.data).toHaveLength(2);
			expect(result.data[0].retailer_id).toBe("SKU-RING-001");
			expect(result.paging?.cursors?.after).toBe("QVFIUmhkZA");
		});

		it("passes limit and after cursor", async () => {
			const mock = mockFetch(LIST_PRODUCTS_RESPONSE);

			await provider.listProducts({ limit: 25, after: "QVFIUmhkZA" });

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("limit=25");
			expect(url).toContain("after=QVFIUmhkZA");
		});
	});

	describe("getProduct", () => {
		it("fetches single product with fields", async () => {
			const mock = mockFetch(GET_PRODUCT_RESPONSE);

			const result = await provider.getProduct("4857392018273645");

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("graph.facebook.com/v19.0/4857392018273645");

			expect(result.id).toBe("4857392018273645");
			expect(result.name).toBe("Gold Statement Ring");
			expect(result.visibility).toBe("published");
		});
	});

	// ── Order operations ────────────────────────────────────────────────

	describe("listOrders", () => {
		it("calls commerce orders endpoint", async () => {
			const mock = mockFetch(LIST_ORDERS_RESPONSE);

			const result = await provider.listOrders();

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain(
				"graph.facebook.com/v19.0/987654321098765/commerce_orders",
			);

			expect(result.data).toHaveLength(1);
			expect(result.data[0].channel).toBe("instagram");
			expect(result.data[0].buyer_details?.name).toBe("Sarah Chen");
		});

		it("passes state filter", async () => {
			const mock = mockFetch(LIST_ORDERS_RESPONSE);

			await provider.listOrders({ state: "IN_PROGRESS" });

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("state=IN_PROGRESS");
		});
	});

	describe("getOrder", () => {
		it("fetches single order by ID", async () => {
			mockFetch(GET_ORDER_RESPONSE);

			const result = await provider.getOrder("1234567890123456");

			expect(result.id).toBe("1234567890123456");
			expect(result.items?.data).toHaveLength(1);
			expect(result.shipping_address?.city).toBe("Portland");
		});
	});

	describe("createShipment", () => {
		it("sends shipment with tracking and items", async () => {
			const mock = mockFetch(CREATE_SHIPMENT_RESPONSE);

			const result = await provider.createShipment("1234567890123456", {
				trackingNumber: "9400111899223456789012",
				carrier: "USPS",
				items: [{ retailer_id: "SKU-RING-001", quantity: 1 }],
			});

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain(
				"graph.facebook.com/v19.0/1234567890123456/shipments",
			);

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.tracking_info.carrier).toBe("USPS");
			expect(body.tracking_info.tracking_number).toBe("9400111899223456789012");
			expect(body.items).toHaveLength(1);
			expect(body.idempotency_key).toBeDefined();

			expect(result.success).toBe(true);
		});
	});

	// ── Error handling ──────────────────────────────────────────────────

	describe("error handling", () => {
		it("throws with error message from Meta API response", async () => {
			mockFetch(META_ERROR_RESPONSE, 400);

			await expect(
				provider.createProduct({
					retailer_id: "SKU-001",
					name: "",
					price: 0,
					image_url: "https://example.com/img.jpg",
				}),
			).rejects.toThrow(
				"Meta Graph API error: (#100) Missing required parameter: name",
			);
		});

		it("throws with HTTP status when error body is unparseable", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				json: () => Promise.reject(new Error("not json")),
			});

			await expect(provider.listProducts()).rejects.toThrow(
				"Meta Graph API error: HTTP 500",
			);
		});

		it("handles rate limit errors", async () => {
			mockFetch(
				{
					error: {
						message: "(#4) Application request limit reached",
						type: "OAuthException",
						code: 4,
					},
				},
				429,
			);

			await expect(provider.listProducts()).rejects.toThrow(
				"Meta Graph API error: (#4) Application request limit reached",
			);
		});
	});

	// ── Access token handling ────────────────────────────────────────────

	describe("access token", () => {
		it("appends access_token as query parameter", async () => {
			const mock = mockFetch(LIST_PRODUCTS_RESPONSE);

			await provider.listProducts();

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("access_token=IGQVJWbzlUaWRkSEhPNnJfX3B5ZA");
		});

		it("appends with & when URL already has query params", async () => {
			const mock = mockFetch(LIST_PRODUCTS_RESPONSE);

			await provider.listProducts({ limit: 10 });

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("&access_token=");
		});
	});
});

// ── Mapping helper tests ────────────────────────────────────────────────────

describe("mapMetaOrderStatus", () => {
	it("maps FB_PROCESSING to pending", () => {
		expect(mapMetaOrderStatus("FB_PROCESSING")).toBe("pending");
	});
	it("maps CREATED to pending", () => {
		expect(mapMetaOrderStatus("CREATED")).toBe("pending");
	});
	it("maps IN_PROGRESS to confirmed", () => {
		expect(mapMetaOrderStatus("IN_PROGRESS")).toBe("confirmed");
	});
	it("maps COMPLETED to delivered", () => {
		expect(mapMetaOrderStatus("COMPLETED")).toBe("delivered");
	});
	it("maps unknown status to pending", () => {
		expect(mapMetaOrderStatus("SOME_NEW_STATUS")).toBe("pending");
	});
});

describe("parseMetaMoney", () => {
	it("parses cents string to dollar amount", () => {
		expect(parseMetaMoney("8999")).toBe(89.99);
	});
	it("parses zero", () => {
		expect(parseMetaMoney("0")).toBe(0);
	});
	it("returns 0 for undefined", () => {
		expect(parseMetaMoney(undefined)).toBe(0);
	});
	it("returns 0 for empty string", () => {
		expect(parseMetaMoney("")).toBe(0);
	});
	it("returns 0 for non-numeric string", () => {
		expect(parseMetaMoney("not-a-number")).toBe(0);
	});
});
