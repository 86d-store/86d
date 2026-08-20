import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	mapTikTokOrderStatus,
	mapTikTokProductStatus,
	parseTikTokMoney,
	TikTokShopProvider,
} from "../provider";

// ── Realistic TikTok Shop API response fixtures ─────────────────────────────

const CREATE_PRODUCT_RESPONSE = {
	code: 0,
	message: "Success",
	data: { product_id: "1729384756102938" },
	request_id: "req-abc-123",
};

const UPDATE_PRODUCT_RESPONSE = {
	code: 0,
	message: "Success",
	data: { product_id: "1729384756102938" },
};

const DELETE_PRODUCT_RESPONSE = {
	code: 0,
	message: "Success",
	data: { deleted_product_ids: ["1729384756102938"] },
};

const GET_PRODUCT_RESPONSE = {
	code: 0,
	message: "Success",
	data: {
		id: "1729384756102938",
		title: "Trendy Phone Case",
		description: "Durable silicone phone case with viral design",
		status: 4,
		skus: [
			{
				id: "sku-001",
				seller_sku: "CASE-BLK-001",
				price: { amount: "14.99", currency: "USD" },
				inventory: [{ quantity: 500 }],
			},
		],
		category_id: "601234",
		brand: { id: "brand-001", name: "CaseCo" },
		create_time: 1718400000,
		update_time: 1718500000,
	},
};

const LIST_PRODUCTS_RESPONSE = {
	code: 0,
	message: "Success",
	data: {
		total_count: 2,
		next_page_token: "page-token-2",
		list: [
			{
				id: "1729384756102938",
				title: "Trendy Phone Case",
				status: 4,
				skus: [
					{
						id: "sku-001",
						seller_sku: "CASE-BLK-001",
						price: { amount: "14.99", currency: "USD" },
					},
				],
				create_time: 1718400000,
				update_time: 1718500000,
			},
			{
				id: "2839475861203847",
				title: "LED Ring Light",
				status: 4,
				skus: [
					{
						id: "sku-002",
						seller_sku: "LIGHT-RGB-001",
						price: { amount: "29.99", currency: "USD" },
					},
				],
				create_time: 1718300000,
				update_time: 1718400000,
			},
		],
	},
};

const LIST_ORDERS_RESPONSE = {
	code: 0,
	message: "Success",
	data: {
		total_count: 1,
		list: [
			{
				id: "576849302716384950",
				status: 121,
				create_time: 1718400000,
				update_time: 1718500000,
				payment: {
					total_amount: "44.98",
					shipping_fee: "5.99",
					platform_discount: "2.00",
					currency: "USD",
				},
				recipient_address: {
					name: "Alex Kim",
					phone: "+1234567890",
					full_address: "789 Broadway, New York, NY 10003",
					region_code: "US",
					city: "New York",
					state: "NY",
					zipcode: "10003",
				},
				line_items: [
					{
						id: "line-001",
						product_id: "1729384756102938",
						product_name: "Trendy Phone Case",
						sku_id: "sku-001",
						seller_sku: "CASE-BLK-001",
						quantity: 2,
						sale_price: "14.99",
					},
					{
						id: "line-002",
						product_id: "2839475861203847",
						product_name: "LED Ring Light",
						sku_id: "sku-002",
						seller_sku: "LIGHT-RGB-001",
						quantity: 1,
						sale_price: "29.99",
					},
				],
			},
		],
	},
};

const GET_ORDER_RESPONSE = {
	code: 0,
	message: "Success",
	data: {
		id: "576849302716384950",
		status: 121,
		create_time: 1718400000,
		update_time: 1718500000,
		payment: {
			total_amount: "44.98",
			shipping_fee: "5.99",
			platform_discount: "2.00",
			currency: "USD",
		},
		recipient_address: {
			name: "Alex Kim",
			full_address: "789 Broadway, New York, NY 10003",
			city: "New York",
			state: "NY",
			zipcode: "10003",
		},
		line_items: [
			{
				id: "line-001",
				product_id: "1729384756102938",
				product_name: "Trendy Phone Case",
				sku_id: "sku-001",
				quantity: 2,
				sale_price: "14.99",
			},
		],
	},
};

const SHIP_ORDER_RESPONSE = {
	code: 0,
	message: "Success",
	data: { package_id: "pkg-abc-123" },
};

const API_ERROR_RESPONSE = {
	code: 105001,
	message: "Product not found",
	request_id: "req-error-456",
};

// ── Provider tests ──────────────────────────────────────────────────────────

describe("TikTokShopProvider", () => {
	let provider: TikTokShopProvider;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		provider = new TikTokShopProvider({
			appKey: "6a2b3c4d5e6f7g8h",
			appSecret: "secret-xyz-abc-123",
			accessToken: "TTP_access_token_abc123",
			shopId: "7012345678901234567",
			sandbox: true,
		});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	function mockFetch(response: unknown) {
		const mock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.resolve(response),
		});
		globalThis.fetch = mock;
		return mock;
	}

	// ── Request signing ─────────────────────────────────────────────────

	describe("request signing", () => {
		it("includes app_key, timestamp, shop_id, sign in query params", async () => {
			const mock = mockFetch(LIST_PRODUCTS_RESPONSE);

			await provider.listProducts();

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("app_key=6a2b3c4d5e6f7g8h");
			expect(url).toContain("shop_id=7012345678901234567");
			expect(url).toContain("access_token=TTP_access_token_abc123");
			expect(url).toContain("sign=");
			expect(url).toContain("timestamp=");
			expect(url).toContain("version=202309");
		});

		it("uses sandbox URL when configured", async () => {
			const mock = mockFetch(LIST_PRODUCTS_RESPONSE);

			await provider.listProducts();

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("open-api-sandbox.tiktokglobalshop.com");
		});

		it("uses production URL when sandbox is false", async () => {
			const prodProvider = new TikTokShopProvider({
				appKey: "key",
				appSecret: "secret",
				accessToken: "token",
				shopId: "shop",
				sandbox: false,
			});

			const mock = mockFetch(LIST_PRODUCTS_RESPONSE);
			await prodProvider.listProducts();

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("open-api.tiktokglobalshop.com");
		});
	});

	// ── Product operations ──────────────────────────────────────────────

	describe("createProduct", () => {
		it("sends POST to products endpoint", async () => {
			const mock = mockFetch(CREATE_PRODUCT_RESPONSE);

			const result = await provider.createProduct({
				title: "New Phone Case",
				description: "Great case",
				category_id: "601234",
				images: [{ uri: "https://cdn.example.com/img.jpg" }],
				skus: [
					{
						seller_sku: "CASE-RED-001",
						price: { amount: "19.99", currency: "USD" },
						inventory: [{ warehouse_id: "wh-1", quantity: 100 }],
					},
				],
			});

			const opts = mock.mock.calls[0][1];
			expect(opts.method).toBe("POST");
			const body = JSON.parse(opts.body);
			expect(body.title).toBe("New Phone Case");
			expect(body.skus[0].seller_sku).toBe("CASE-RED-001");

			expect(result.product_id).toBe("1729384756102938");
		});
	});

	describe("updateProduct", () => {
		it("sends PUT to product ID", async () => {
			const mock = mockFetch(UPDATE_PRODUCT_RESPONSE);

			const result = await provider.updateProduct("1729384756102938", {
				title: "Updated Phone Case",
			});

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("/products/1729384756102938");
			expect(mock.mock.calls[0][1].method).toBe("PUT");
			expect(result.product_id).toBe("1729384756102938");
		});
	});

	describe("deleteProduct", () => {
		it("sends DELETE with product IDs", async () => {
			const mock = mockFetch(DELETE_PRODUCT_RESPONSE);

			const result = await provider.deleteProduct("1729384756102938");

			expect(mock.mock.calls[0][1].method).toBe("DELETE");
			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.product_ids).toEqual(["1729384756102938"]);
			expect(result.deleted_product_ids).toContain("1729384756102938");
		});
	});

	describe("listProducts", () => {
		it("returns paginated product list", async () => {
			mockFetch(LIST_PRODUCTS_RESPONSE);

			const result = await provider.listProducts();

			expect(result.total_count).toBe(2);
			expect(result.list).toHaveLength(2);
			expect(result.list?.[0].title).toBe("Trendy Phone Case");
			expect(result.list?.[1].title).toBe("LED Ring Light");
			expect(result.next_page_token).toBe("page-token-2");
		});

		it("passes pagination params", async () => {
			const mock = mockFetch(LIST_PRODUCTS_RESPONSE);

			await provider.listProducts({
				page_size: 25,
				page_token: "page-token-2",
			});

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.page_size).toBe(25);
			expect(body.page_token).toBe("page-token-2");
		});
	});

	describe("getProduct", () => {
		it("fetches single product by ID", async () => {
			const mock = mockFetch(GET_PRODUCT_RESPONSE);

			const result = await provider.getProduct("1729384756102938");

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("/products/1729384756102938");
			expect(result.title).toBe("Trendy Phone Case");
			expect(result.status).toBe(4);
			expect(result.skus?.[0].seller_sku).toBe("CASE-BLK-001");
		});
	});

	// ── Order operations ────────────────────────────────────────────────

	describe("listOrders", () => {
		it("returns order list", async () => {
			mockFetch(LIST_ORDERS_RESPONSE);

			const result = await provider.listOrders();

			expect(result.list).toHaveLength(1);
			expect(result.list?.[0].id).toBe("576849302716384950");
			expect(result.list?.[0].status).toBe(121);
			expect(result.list?.[0].line_items).toHaveLength(2);
			expect(result.list?.[0].recipient_address?.name).toBe("Alex Kim");
		});

		it("passes order status filter", async () => {
			const mock = mockFetch(LIST_ORDERS_RESPONSE);

			await provider.listOrders({ order_status: 121 });

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.order_status).toBe(121);
		});
	});

	describe("getOrderDetail", () => {
		it("fetches single order", async () => {
			const mock = mockFetch(GET_ORDER_RESPONSE);

			const result = await provider.getOrderDetail("576849302716384950");

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("/orders/576849302716384950");
			expect(result.id).toBe("576849302716384950");
			expect(result.payment?.total_amount).toBe("44.98");
		});
	});

	describe("shipOrder", () => {
		it("sends shipment with tracking info", async () => {
			const mock = mockFetch(SHIP_ORDER_RESPONSE);

			const result = await provider.shipOrder("576849302716384950", {
				tracking_number: "1Z999AA10123456784",
				shipping_provider_id: "ups",
			});

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("/orders/576849302716384950/packages");

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.tracking_number).toBe("1Z999AA10123456784");
			expect(body.shipping_provider_id).toBe("ups");
			expect(result.package_id).toBe("pkg-abc-123");
		});
	});

	// ── Error handling ──────────────────────────────────────────────────

	describe("error handling", () => {
		it("throws with API error message and code", async () => {
			mockFetch(API_ERROR_RESPONSE);

			await expect(provider.getProduct("nonexistent")).rejects.toThrow(
				"TikTok Shop API error: Product not found (code 105001)",
			);
		});
	});
});

// ── Mapping helper tests ────────────────────────────────────────────────────

describe("mapTikTokOrderStatus", () => {
	it("maps 100 (Unpaid) to pending", () => {
		expect(mapTikTokOrderStatus(100)).toBe("pending");
	});
	it("maps 111 (On hold) to pending", () => {
		expect(mapTikTokOrderStatus(111)).toBe("pending");
	});
	it("maps 112 (Partially shipped) to confirmed", () => {
		expect(mapTikTokOrderStatus(112)).toBe("confirmed");
	});
	it("maps 114 (Awaiting collection) to confirmed", () => {
		expect(mapTikTokOrderStatus(114)).toBe("confirmed");
	});
	it("maps 121 (In transit) to shipped", () => {
		expect(mapTikTokOrderStatus(121)).toBe("shipped");
	});
	it("maps 122 (Delivered) to delivered", () => {
		expect(mapTikTokOrderStatus(122)).toBe("delivered");
	});
	it("maps 130 (Completed) to delivered", () => {
		expect(mapTikTokOrderStatus(130)).toBe("delivered");
	});
	it("maps 140 (Cancelled) to cancelled", () => {
		expect(mapTikTokOrderStatus(140)).toBe("cancelled");
	});
	it("maps unknown status to pending", () => {
		expect(mapTikTokOrderStatus(999)).toBe("pending");
	});
});

describe("mapTikTokProductStatus", () => {
	it("maps 1 to draft", () => {
		expect(mapTikTokProductStatus(1)).toBe("draft");
	});
	it("maps 2 to pending", () => {
		expect(mapTikTokProductStatus(2)).toBe("pending");
	});
	it("maps 3 to rejected", () => {
		expect(mapTikTokProductStatus(3)).toBe("rejected");
	});
	it("maps 4 to active", () => {
		expect(mapTikTokProductStatus(4)).toBe("active");
	});
	it("maps 5 (seller deactivated) to suspended", () => {
		expect(mapTikTokProductStatus(5)).toBe("suspended");
	});
	it("maps 6 (platform deactivated) to suspended", () => {
		expect(mapTikTokProductStatus(6)).toBe("suspended");
	});
	it("maps 7 (frozen) to suspended", () => {
		expect(mapTikTokProductStatus(7)).toBe("suspended");
	});
	it("maps unknown to draft", () => {
		expect(mapTikTokProductStatus(99)).toBe("draft");
	});
});

describe("parseTikTokMoney", () => {
	it("parses valid amount", () => {
		expect(parseTikTokMoney("29.99")).toBe(29.99);
	});
	it("parses zero", () => {
		expect(parseTikTokMoney("0")).toBe(0);
	});
	it("returns 0 for undefined", () => {
		expect(parseTikTokMoney(undefined)).toBe(0);
	});
	it("returns 0 for empty string", () => {
		expect(parseTikTokMoney("")).toBe(0);
	});
	it("returns 0 for non-numeric", () => {
		expect(parseTikTokMoney("not-a-number")).toBe(0);
	});
});
