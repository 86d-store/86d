import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	MetaCommerceProvider,
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
	retailer_id: "SKU-WIDGET-001",
	name: "Premium Widget",
	description: "A high-quality widget for all your needs",
	availability: "in stock",
	price: "2999",
	currency: "USD",
	image_url: "https://cdn.example.com/images/widget-001.jpg",
	url: "https://example.com/products/widget-001",
	brand: "WidgetCo",
	inventory: 150,
	visibility: "published",
};

const LIST_PRODUCTS_RESPONSE = {
	data: [
		{
			id: "4857392018273645",
			retailer_id: "SKU-WIDGET-001",
			name: "Premium Widget",
			description: "A high-quality widget",
			availability: "in stock",
			price: "2999",
			currency: "USD",
			image_url: "https://cdn.example.com/images/widget-001.jpg",
			brand: "WidgetCo",
			inventory: 150,
			visibility: "published",
		},
		{
			id: "5928403129384756",
			retailer_id: "SKU-GADGET-002",
			name: "Deluxe Gadget",
			description: "An innovative gadget",
			availability: "in stock",
			price: "4999",
			currency: "USD",
			image_url: "https://cdn.example.com/images/gadget-002.jpg",
			brand: "GadgetWorks",
			inventory: 75,
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

const LIST_PRODUCTS_EMPTY_RESPONSE = {
	data: [],
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
						retailer_id: "SKU-WIDGET-001",
						quantity: 2,
						price_per_unit: { amount: "2999", currency: "USD" },
					},
					{
						id: "item-002",
						product_id: "5928403129384756",
						retailer_id: "SKU-GADGET-002",
						quantity: 1,
						price_per_unit: { amount: "4999", currency: "USD" },
					},
				],
			},
			buyer_details: {
				name: "Jane Doe",
				email: "jane@example.com",
			},
			shipping_address: {
				street1: "123 Main St",
				street2: "Apt 4B",
				city: "San Francisco",
				state: "CA",
				postal_code: "94102",
				country: "US",
				name: "Jane Doe",
			},
			estimated_payment_details: {
				subtotal: { amount: "10997", currency: "USD" },
				tax: { amount: "990", currency: "USD" },
				total_amount: { amount: "12486", currency: "USD" },
				shipping: { amount: "499", currency: "USD" },
			},
			channel: "facebook",
		},
		{
			id: "9876543210987654",
			order_status: {
				state: "CREATED",
			},
			created: "2024-06-14T15:00:00+0000",
			last_updated: "2024-06-14T15:05:00+0000",
			items: {
				data: [
					{
						id: "item-003",
						product_id: "4857392018273645",
						retailer_id: "SKU-WIDGET-001",
						quantity: 1,
						price_per_unit: { amount: "2999", currency: "USD" },
					},
				],
			},
			buyer_details: {
				name: "John Smith",
			},
			estimated_payment_details: {
				subtotal: { amount: "2999", currency: "USD" },
				tax: { amount: "270", currency: "USD" },
				total_amount: { amount: "3768", currency: "USD" },
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
				retailer_id: "SKU-WIDGET-001",
				quantity: 2,
				price_per_unit: { amount: "2999", currency: "USD" },
			},
		],
	},
	buyer_details: {
		name: "Jane Doe",
		email: "jane@example.com",
	},
	shipping_address: {
		street1: "123 Main St",
		city: "San Francisco",
		state: "CA",
		postal_code: "94102",
		country: "US",
	},
	estimated_payment_details: {
		subtotal: { amount: "5998", currency: "USD" },
		tax: { amount: "540", currency: "USD" },
		total_amount: { amount: "7037", currency: "USD" },
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

describe("MetaCommerceProvider", () => {
	let provider: MetaCommerceProvider;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		provider = new MetaCommerceProvider({
			accessToken: "EAABwzLixnjYBO0abc123def456",
			catalogId: "123456789012345",
			commerceAccountId: "987654321098765",
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
				retailer_id: "SKU-WIDGET-001",
				name: "Premium Widget",
				price: 29.99,
				image_url: "https://cdn.example.com/images/widget.jpg",
				description: "A great widget",
				brand: "WidgetCo",
			});

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain(
				"graph.facebook.com/v19.0/123456789012345/products",
			);
			expect(url).toContain("access_token=EAABwzLixnjYBO0abc123def456");

			const opts = mock.mock.calls[0][1];
			expect(opts.method).toBe("POST");
			const body = JSON.parse(opts.body);
			expect(body.retailer_id).toBe("SKU-WIDGET-001");
			expect(body.name).toBe("Premium Widget");
			expect(body.price).toBe("2999");
			expect(body.currency).toBe("USD");
			expect(body.availability).toBe("in stock");
			expect(body.condition).toBe("new");
			expect(body.brand).toBe("WidgetCo");

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

		it("includes inventory when provided", async () => {
			const mock = mockFetch(CREATE_PRODUCT_RESPONSE);

			await provider.createProduct({
				retailer_id: "SKU-001",
				name: "Test",
				price: 10,
				image_url: "https://example.com/img.jpg",
				inventory: 50,
			});

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.inventory).toBe(50);
		});
	});

	describe("updateProduct", () => {
		it("sends POST to product ID with partial fields", async () => {
			const mock = mockFetch(UPDATE_PRODUCT_RESPONSE);

			const result = await provider.updateProduct("4857392018273645", {
				name: "Updated Widget",
				price: 34.99,
			});

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("graph.facebook.com/v19.0/4857392018273645");

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.name).toBe("Updated Widget");
			expect(body.price).toBe("3499");
			expect(body.retailer_id).toBeUndefined();
			expect(result.success).toBe(true);
		});

		it("does not include undefined fields", async () => {
			const mock = mockFetch(UPDATE_PRODUCT_RESPONSE);

			await provider.updateProduct("4857392018273645", {
				name: "Only Name",
			});

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.name).toBe("Only Name");
			expect(Object.keys(body)).toEqual(["name"]);
		});
	});

	describe("deleteProduct", () => {
		it("sends DELETE request", async () => {
			const mock = mockFetch(DELETE_PRODUCT_RESPONSE);

			const result = await provider.deleteProduct("4857392018273645");

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("graph.facebook.com/v19.0/4857392018273645");
			expect(mock.mock.calls[0][1].method).toBe("DELETE");
			expect(result.success).toBe(true);
		});

		it("URL-encodes product ID", async () => {
			const mock = mockFetch(DELETE_PRODUCT_RESPONSE);

			await provider.deleteProduct("product/with spaces");

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("product%2Fwith%20spaces");
		});
	});

	describe("listProducts", () => {
		it("calls catalog products endpoint with fields", async () => {
			const mock = mockFetch(LIST_PRODUCTS_RESPONSE);

			const result = await provider.listProducts();

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain(
				"graph.facebook.com/v19.0/123456789012345/products",
			);
			expect(url).toContain("fields=");
			expect(mock.mock.calls[0][1].method).toBe("GET");

			expect(result.data).toHaveLength(2);
			expect(result.data[0].retailer_id).toBe("SKU-WIDGET-001");
			expect(result.data[1].name).toBe("Deluxe Gadget");
			expect(result.paging?.cursors?.after).toBe("QVFIUmhkZA");
		});

		it("passes limit and after cursor", async () => {
			const mock = mockFetch(LIST_PRODUCTS_RESPONSE);

			await provider.listProducts({ limit: 25, after: "QVFIUmhkZA" });

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("limit=25");
			expect(url).toContain("after=QVFIUmhkZA");
		});

		it("handles empty product list", async () => {
			mockFetch(LIST_PRODUCTS_EMPTY_RESPONSE);

			const result = await provider.listProducts();
			expect(result.data).toHaveLength(0);
		});
	});

	describe("getProduct", () => {
		it("fetches single product with fields", async () => {
			const mock = mockFetch(GET_PRODUCT_RESPONSE);

			const result = await provider.getProduct("4857392018273645");

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("graph.facebook.com/v19.0/4857392018273645");
			expect(url).toContain("fields=");

			expect(result.id).toBe("4857392018273645");
			expect(result.retailer_id).toBe("SKU-WIDGET-001");
			expect(result.name).toBe("Premium Widget");
			expect(result.visibility).toBe("published");
			expect(result.inventory).toBe(150);
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
			expect(url).toContain("fields=");

			expect(result.data).toHaveLength(2);
			expect(result.data[0].id).toBe("1234567890123456");
			expect(result.data[0].order_status.state).toBe("IN_PROGRESS");
			expect(result.data[0].buyer_details?.name).toBe("Jane Doe");
			expect(result.data[1].channel).toBe("instagram");
		});

		it("passes state filter", async () => {
			const mock = mockFetch(LIST_ORDERS_RESPONSE);

			await provider.listOrders({ state: "IN_PROGRESS" });

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("state=IN_PROGRESS");
		});

		it("passes time range filters", async () => {
			const mock = mockFetch(LIST_ORDERS_RESPONSE);

			await provider.listOrders({
				updatedAfter: 1718400000,
				updatedBefore: 1718500000,
			});

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("updated_after=1718400000");
			expect(url).toContain("updated_before=1718500000");
		});
	});

	describe("getOrder", () => {
		it("fetches single order by ID", async () => {
			const mock = mockFetch(GET_ORDER_RESPONSE);

			const result = await provider.getOrder("1234567890123456");

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("graph.facebook.com/v19.0/1234567890123456");
			expect(url).toContain("fields=");

			expect(result.id).toBe("1234567890123456");
			expect(result.order_status.state).toBe("IN_PROGRESS");
			expect(result.items?.data).toHaveLength(1);
			expect(result.shipping_address?.city).toBe("San Francisco");
		});
	});

	describe("createShipment", () => {
		it("sends shipment with tracking and items", async () => {
			const mock = mockFetch(CREATE_SHIPMENT_RESPONSE);

			const result = await provider.createShipment("1234567890123456", {
				trackingNumber: "1Z999AA10123456784",
				carrier: "UPS",
				items: [
					{ retailer_id: "SKU-WIDGET-001", quantity: 2 },
					{ retailer_id: "SKU-GADGET-002", quantity: 1 },
				],
			});

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain(
				"graph.facebook.com/v19.0/1234567890123456/shipments",
			);

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.tracking_info.carrier).toBe("UPS");
			expect(body.tracking_info.tracking_number).toBe("1Z999AA10123456784");
			expect(body.items).toHaveLength(2);
			expect(body.items[0].retailer_id).toBe("SKU-WIDGET-001");
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

		it("handles 403 Forbidden errors", async () => {
			mockFetch(
				{
					error: {
						message: "(#200) Requires manage_business_extension permission",
						type: "OAuthException",
						code: 200,
					},
				},
				403,
			);

			await expect(provider.listOrders()).rejects.toThrow(
				"Meta Graph API error: (#200) Requires manage_business_extension permission",
			);
		});

		it("handles rate limit errors (code 4)", async () => {
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
			expect(url).toContain("access_token=EAABwzLixnjYBO0abc123def456");
		});

		it("URL-encodes access token", async () => {
			const specialProvider = new MetaCommerceProvider({
				accessToken: "token with spaces&specials=yes",
				catalogId: "123",
				commerceAccountId: "456",
			});

			const mock = mockFetch(LIST_PRODUCTS_RESPONSE);
			await specialProvider.listProducts();

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain(
				"access_token=token%20with%20spaces%26specials%3Dyes",
			);
		});

		it("appends with & when URL already has query params", async () => {
			const mock = mockFetch(LIST_PRODUCTS_RESPONSE);

			await provider.listProducts({ limit: 10 });

			const url = mock.mock.calls[0][0] as string;
			// URL has fields= and limit= already, so access_token should use &
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
		expect(parseMetaMoney("2999")).toBe(29.99);
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
	it("handles large amounts", () => {
		expect(parseMetaMoney("1000000")).toBe(10000);
	});
});
