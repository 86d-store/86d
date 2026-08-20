import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	GoogleApiErrorResponse,
	GoogleProduct,
	GoogleProductStatusesListResponse,
	GoogleProductsListResponse,
} from "../provider";
import {
	GoogleShoppingProvider,
	mapAvailabilityFromGoogle,
	mapAvailabilityToGoogle,
	mapProductStatusToInternal,
} from "../provider";

// ── Realistic Google Content API v2.1 response fixtures ─────────────────────

const INSERTED_PRODUCT_RESPONSE: GoogleProduct = {
	id: "online:en:US:widget-001",
	offerId: "widget-001",
	title: "Premium Widget",
	description: "A high-quality widget for everyday use",
	link: "https://example.com/products/widget-001",
	imageLink: "https://example.com/images/widget-001.jpg",
	contentLanguage: "en",
	targetCountry: "US",
	channel: "online",
	availability: "in_stock",
	condition: "new",
	price: { value: "29.99", currency: "USD" },
	salePrice: { value: "24.99", currency: "USD" },
	gtin: "012345678905",
	brand: "WidgetCo",
	googleProductCategory: "Hardware > Tools > Hand Tools",
};

const GET_PRODUCT_RESPONSE: GoogleProduct = {
	id: "online:en:US:gadget-002",
	offerId: "gadget-002",
	title: "Deluxe Gadget",
	description: "The finest gadget money can buy",
	link: "https://example.com/products/gadget-002",
	imageLink: "https://example.com/images/gadget-002.jpg",
	contentLanguage: "en",
	targetCountry: "US",
	channel: "online",
	availability: "in_stock",
	condition: "new",
	price: { value: "49.99", currency: "USD" },
	mpn: "GDG-002-A",
	brand: "GadgetWorld",
};

const LIST_PRODUCTS_RESPONSE: GoogleProductsListResponse = {
	kind: "content#productsListResponse",
	resources: [
		{
			id: "online:en:US:widget-001",
			offerId: "widget-001",
			title: "Premium Widget",
			link: "https://example.com/products/widget-001",
			imageLink: "https://example.com/images/widget-001.jpg",
			contentLanguage: "en",
			targetCountry: "US",
			channel: "online",
			availability: "in_stock",
			condition: "new",
			price: { value: "29.99", currency: "USD" },
			brand: "WidgetCo",
		},
		{
			id: "online:en:US:gadget-002",
			offerId: "gadget-002",
			title: "Deluxe Gadget",
			link: "https://example.com/products/gadget-002",
			imageLink: "https://example.com/images/gadget-002.jpg",
			contentLanguage: "en",
			targetCountry: "US",
			channel: "online",
			availability: "out_of_stock",
			condition: "refurbished",
			price: { value: "49.99", currency: "USD" },
			brand: "GadgetWorld",
		},
	],
	nextPageToken: "CiAKGjBpNDd2Nmp2Zml2cXRwYjBpOXA",
};

const LIST_PRODUCTS_EMPTY_RESPONSE: GoogleProductsListResponse = {
	kind: "content#productsListResponse",
};

const LIST_PRODUCT_STATUSES_RESPONSE: GoogleProductStatusesListResponse = {
	kind: "content#productstatusesListResponse",
	resources: [
		{
			productId: "online:en:US:widget-001",
			title: "Premium Widget",
			destinationStatuses: [
				{ destination: "SurfacesAcrossGoogle", status: "approved" },
				{ destination: "Shopping", status: "approved" },
			],
			itemLevelIssues: [],
		},
		{
			productId: "online:en:US:gadget-002",
			title: "Deluxe Gadget",
			destinationStatuses: [
				{ destination: "SurfacesAcrossGoogle", status: "disapproved" },
				{ destination: "Shopping", status: "disapproved" },
			],
			itemLevelIssues: [
				{
					code: "image_link_broken",
					servability: "disapproved",
					resolution: "merchant_action",
					attributeName: "image_link",
					destination: "Shopping",
					description: "Image link is broken or returns an error",
					detail: "Update the image link to a working URL",
					documentation: "https://support.google.com/merchants/answer/6098289",
				},
				{
					code: "missing_gtin",
					servability: "demoted",
					resolution: "merchant_action",
					attributeName: "gtin",
					description: "Missing GTIN for this product",
				},
			],
		},
		{
			productId: "online:en:US:accessory-003",
			title: "Accessory Kit",
			destinationStatuses: [
				{ destination: "SurfacesAcrossGoogle", status: "pending" },
				{ destination: "Shopping", status: "pending" },
			],
			itemLevelIssues: [],
		},
	],
	nextPageToken: "token-page-2",
};

const API_ERROR_RESPONSE: GoogleApiErrorResponse = {
	error: {
		code: 400,
		message: "The value provided for attribute 'price' is invalid.",
		status: "INVALID_ARGUMENT",
		errors: [
			{
				message: "The value provided for attribute 'price' is invalid.",
				domain: "content.ContentErrorDomain",
				reason: "invalid",
			},
		],
	},
};

const AUTH_ERROR_RESPONSE: GoogleApiErrorResponse = {
	error: {
		code: 401,
		message: "Request had invalid authentication credentials.",
		status: "UNAUTHENTICATED",
	},
};

const NOT_FOUND_ERROR_RESPONSE: GoogleApiErrorResponse = {
	error: {
		code: 404,
		message: "Product not found: online:en:US:nonexistent",
		status: "NOT_FOUND",
	},
};

// ── Provider tests ──────────────────────────────────────────────────────────

describe("GoogleShoppingProvider", () => {
	let provider: GoogleShoppingProvider;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		provider = new GoogleShoppingProvider("123456789", "AIzaSyTestApiKey123");
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	function mockFetch(body: unknown, ok = true, status = 200) {
		const mock = vi.fn().mockResolvedValue({
			ok,
			status,
			json: () => Promise.resolve(body),
		});
		globalThis.fetch = mock;
		return mock;
	}

	// ── insertProduct ───────────────────────────────────────────────────

	describe("insertProduct", () => {
		it("sends POST to correct endpoint with product body", async () => {
			const mock = mockFetch(INSERTED_PRODUCT_RESPONSE);

			const product: GoogleProduct = {
				offerId: "widget-001",
				title: "Premium Widget",
				description: "A high-quality widget for everyday use",
				link: "https://example.com/products/widget-001",
				imageLink: "https://example.com/images/widget-001.jpg",
				contentLanguage: "en",
				targetCountry: "US",
				channel: "online",
				availability: "in_stock",
				condition: "new",
				price: { value: "29.99", currency: "USD" },
				salePrice: { value: "24.99", currency: "USD" },
				gtin: "012345678905",
				brand: "WidgetCo",
				googleProductCategory: "Hardware > Tools > Hand Tools",
			};

			const result = await provider.insertProduct(product);

			expect(mock).toHaveBeenCalledTimes(1);
			const [url, options] = mock.mock.calls[0];
			expect(url).toContain(
				"shoppingcontent.googleapis.com/content/v2.1/123456789/products",
			);
			expect(url).toContain("key=AIzaSyTestApiKey123");
			expect(options.method).toBe("POST");
			expect(options.headers).toMatchObject({
				"Content-Type": "application/json",
			});

			const body = JSON.parse(options.body);
			expect(body.offerId).toBe("widget-001");
			expect(body.title).toBe("Premium Widget");
			expect(body.price).toEqual({ value: "29.99", currency: "USD" });
			expect(body.salePrice).toEqual({ value: "24.99", currency: "USD" });
			expect(body.gtin).toBe("012345678905");
			expect(body.googleProductCategory).toBe("Hardware > Tools > Hand Tools");

			expect(result.id).toBe("online:en:US:widget-001");
			expect(result.offerId).toBe("widget-001");
			expect(result.title).toBe("Premium Widget");
		});

		it("handles product without optional fields", async () => {
			const minimalResponse: GoogleProduct = {
				id: "online:en:US:basic-001",
				offerId: "basic-001",
				title: "Basic Item",
				link: "https://example.com/basic",
				imageLink: "https://example.com/basic.jpg",
				contentLanguage: "en",
				targetCountry: "US",
				channel: "online",
				availability: "in_stock",
				condition: "new",
				price: { value: "9.99", currency: "USD" },
			};
			const mock = mockFetch(minimalResponse);

			const product: GoogleProduct = {
				offerId: "basic-001",
				title: "Basic Item",
				link: "https://example.com/basic",
				imageLink: "https://example.com/basic.jpg",
				contentLanguage: "en",
				targetCountry: "US",
				channel: "online",
				availability: "in_stock",
				condition: "new",
				price: { value: "9.99", currency: "USD" },
			};

			const result = await provider.insertProduct(product);

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.salePrice).toBeUndefined();
			expect(body.gtin).toBeUndefined();
			expect(body.brand).toBeUndefined();
			expect(result.id).toBe("online:en:US:basic-001");
		});

		it("throws on API error with descriptive message", async () => {
			mockFetch(API_ERROR_RESPONSE, false, 400);

			await expect(
				provider.insertProduct({
					offerId: "bad-product",
					title: "Bad",
					link: "https://example.com",
					imageLink: "https://example.com/img.jpg",
					contentLanguage: "en",
					targetCountry: "US",
					channel: "online",
					availability: "in_stock",
					condition: "new",
					price: { value: "invalid", currency: "USD" },
				}),
			).rejects.toThrow(
				"Google Shopping API error: The value provided for attribute 'price' is invalid.",
			);
		});
	});

	// ── getProduct ──────────────────────────────────────────────────────

	describe("getProduct", () => {
		it("sends GET to correct endpoint with product ID", async () => {
			const mock = mockFetch(GET_PRODUCT_RESPONSE);

			const result = await provider.getProduct("online:en:US:gadget-002");

			const [url, options] = mock.mock.calls[0];
			expect(url).toContain(
				"/123456789/products/online%3Aen%3AUS%3Agadget-002",
			);
			expect(url).toContain("key=AIzaSyTestApiKey123");
			expect(options.method).toBe("GET");

			expect(result.id).toBe("online:en:US:gadget-002");
			expect(result.offerId).toBe("gadget-002");
			expect(result.title).toBe("Deluxe Gadget");
			expect(result.price).toEqual({ value: "49.99", currency: "USD" });
			expect(result.mpn).toBe("GDG-002-A");
		});

		it("URL-encodes product IDs with colons", async () => {
			const mock = mockFetch(GET_PRODUCT_RESPONSE);

			await provider.getProduct("online:en:US:special/product");

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("online%3Aen%3AUS%3Aspecial%2Fproduct");
		});

		it("throws on 404 not found", async () => {
			mockFetch(NOT_FOUND_ERROR_RESPONSE, false, 404);

			await expect(
				provider.getProduct("online:en:US:nonexistent"),
			).rejects.toThrow(
				"Google Shopping API error: Product not found: online:en:US:nonexistent",
			);
		});

		it("throws on 401 authentication error", async () => {
			mockFetch(AUTH_ERROR_RESPONSE, false, 401);

			await expect(
				provider.getProduct("online:en:US:widget-001"),
			).rejects.toThrow(
				"Google Shopping API error: Request had invalid authentication credentials.",
			);
		});
	});

	// ── listProducts ────────────────────────────────────────────────────

	describe("listProducts", () => {
		it("lists products with pagination", async () => {
			const mock = mockFetch(LIST_PRODUCTS_RESPONSE);

			const result = await provider.listProducts({
				maxResults: 25,
				pageToken: "prev-page-token",
			});

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("/123456789/products?");
			expect(url).toContain("maxResults=25");
			expect(url).toContain("pageToken=prev-page-token");
			expect(url).toContain("key=AIzaSyTestApiKey123");

			expect(result.kind).toBe("content#productsListResponse");
			expect(result.resources).toHaveLength(2);
			expect(result.resources?.[0].offerId).toBe("widget-001");
			expect(result.resources?.[0].availability).toBe("in_stock");
			expect(result.resources?.[1].offerId).toBe("gadget-002");
			expect(result.resources?.[1].availability).toBe("out_of_stock");
			expect(result.nextPageToken).toBe("CiAKGjBpNDd2Nmp2Zml2cXRwYjBpOXA");
		});

		it("lists products without params", async () => {
			const mock = mockFetch(LIST_PRODUCTS_RESPONSE);

			await provider.listProducts();

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("/123456789/products");
			expect(url).not.toContain("maxResults");
			expect(url).not.toContain("pageToken=");
		});

		it("handles empty product list", async () => {
			mockFetch(LIST_PRODUCTS_EMPTY_RESPONSE);

			const result = await provider.listProducts();

			expect(result.kind).toBe("content#productsListResponse");
			expect(result.resources).toBeUndefined();
			expect(result.nextPageToken).toBeUndefined();
		});
	});

	// ── deleteProduct ───────────────────────────────────────────────────

	describe("deleteProduct", () => {
		it("sends DELETE to correct endpoint", async () => {
			const mock = vi.fn().mockResolvedValue({
				ok: true,
				status: 204,
				json: () => Promise.resolve(undefined),
			});
			globalThis.fetch = mock;

			await provider.deleteProduct("online:en:US:widget-001");

			const [url, options] = mock.mock.calls[0];
			expect(url).toContain(
				"/123456789/products/online%3Aen%3AUS%3Awidget-001",
			);
			expect(options.method).toBe("DELETE");
		});

		it("throws on error when deleting non-existent product", async () => {
			mockFetch(NOT_FOUND_ERROR_RESPONSE, false, 404);

			await expect(
				provider.deleteProduct("online:en:US:nonexistent"),
			).rejects.toThrow("Google Shopping API error");
		});
	});

	// ── listProductStatuses ─────────────────────────────────────────────

	describe("listProductStatuses", () => {
		it("lists product statuses with destination info and issues", async () => {
			const mock = mockFetch(LIST_PRODUCT_STATUSES_RESPONSE);

			const result = await provider.listProductStatuses({
				maxResults: 50,
			});

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("/123456789/productstatuses?");
			expect(url).toContain("maxResults=50");

			expect(result.kind).toBe("content#productstatusesListResponse");
			expect(result.resources).toHaveLength(3);

			const approved = result.resources?.[0];
			expect(approved?.productId).toBe("online:en:US:widget-001");
			expect(approved?.destinationStatuses).toHaveLength(2);
			expect(approved?.destinationStatuses[0].status).toBe("approved");
			expect(approved?.itemLevelIssues).toHaveLength(0);

			const disapproved = result.resources?.[1];
			expect(disapproved?.productId).toBe("online:en:US:gadget-002");
			expect(disapproved?.destinationStatuses[0].status).toBe("disapproved");
			expect(disapproved?.itemLevelIssues).toHaveLength(2);
			expect(disapproved?.itemLevelIssues[0].code).toBe("image_link_broken");
			expect(disapproved?.itemLevelIssues[0].servability).toBe("disapproved");
			expect(disapproved?.itemLevelIssues[0].attributeName).toBe("image_link");

			const pending = result.resources?.[2];
			expect(pending?.productId).toBe("online:en:US:accessory-003");
			expect(pending?.destinationStatuses[0].status).toBe("pending");

			expect(result.nextPageToken).toBe("token-page-2");
		});

		it("passes pageToken parameter", async () => {
			const mock = mockFetch(LIST_PRODUCT_STATUSES_RESPONSE);

			await provider.listProductStatuses({
				pageToken: "token-page-2",
			});

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("pageToken=token-page-2");
		});

		it("works without params", async () => {
			const mock = mockFetch(LIST_PRODUCT_STATUSES_RESPONSE);

			await provider.listProductStatuses();

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("/123456789/productstatuses");
			expect(url).not.toContain("maxResults");
		});
	});

	// ── Error handling ──────────────────────────────────────────────────

	describe("error handling", () => {
		it("throws with error message from Google API error", async () => {
			mockFetch(API_ERROR_RESPONSE, false, 400);

			await expect(provider.listProducts()).rejects.toThrow(
				"Google Shopping API error: The value provided for attribute 'price' is invalid.",
			);
		});

		it("throws with HTTP status when error body lacks message", async () => {
			mockFetch({ error: {} }, false, 500);

			await expect(provider.listProducts()).rejects.toThrow(
				"Google Shopping API error: HTTP 500",
			);
		});

		it("throws when error body is null", async () => {
			const mock = vi.fn().mockResolvedValue({
				ok: false,
				status: 503,
				json: () => Promise.resolve(null),
			});
			globalThis.fetch = mock;

			await expect(provider.listProducts()).rejects.toThrow();
		});

		it("encodes API key in URL correctly", async () => {
			const providerWithSpecialKey = new GoogleShoppingProvider(
				"987654321",
				"key=with+special&chars",
			);
			const mock = mockFetch(LIST_PRODUCTS_EMPTY_RESPONSE);

			await providerWithSpecialKey.listProducts();

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("key=key%3Dwith%2Bspecial%26chars");
			expect(url).toContain("/987654321/products");
		});
	});

	// ── URL construction ────────────────────────────────────────────────

	describe("URL construction", () => {
		it("uses correct base URL", async () => {
			const mock = mockFetch(LIST_PRODUCTS_EMPTY_RESPONSE);

			await provider.listProducts();

			const url = mock.mock.calls[0][0] as string;
			expect(url).toMatch(
				/^https:\/\/shoppingcontent\.googleapis\.com\/content\/v2\.1\//,
			);
		});

		it("includes merchant ID in path", async () => {
			const mock = mockFetch(LIST_PRODUCTS_EMPTY_RESPONSE);

			await provider.listProducts();

			const url = mock.mock.calls[0][0] as string;
			expect(url).toContain("/123456789/");
		});

		it("appends key with ? for paths without query string", async () => {
			const mock = mockFetch(GET_PRODUCT_RESPONSE);

			await provider.getProduct("some-id");

			const url = mock.mock.calls[0][0] as string;
			expect(url).toMatch(/\/products\/some-id\?key=/);
		});

		it("appends key with & for paths with existing query string", async () => {
			const mock = mockFetch(LIST_PRODUCTS_RESPONSE);

			await provider.listProducts({ maxResults: 10 });

			const url = mock.mock.calls[0][0] as string;
			expect(url).toMatch(/maxResults=10&key=/);
		});
	});
});

// ── Mapping helper tests ────────────────────────────────────────────────────

describe("mapAvailabilityFromGoogle", () => {
	it("maps in_stock to in-stock", () => {
		expect(mapAvailabilityFromGoogle("in_stock")).toBe("in-stock");
	});
	it("maps out_of_stock to out-of-stock", () => {
		expect(mapAvailabilityFromGoogle("out_of_stock")).toBe("out-of-stock");
	});
	it("maps preorder to preorder", () => {
		expect(mapAvailabilityFromGoogle("preorder")).toBe("preorder");
	});
	it("defaults to in-stock for unknown values", () => {
		expect(mapAvailabilityFromGoogle("unknown" as "in_stock")).toBe("in-stock");
	});
});

describe("mapAvailabilityToGoogle", () => {
	it("maps in-stock to in_stock", () => {
		expect(mapAvailabilityToGoogle("in-stock")).toBe("in_stock");
	});
	it("maps out-of-stock to out_of_stock", () => {
		expect(mapAvailabilityToGoogle("out-of-stock")).toBe("out_of_stock");
	});
	it("maps preorder to preorder", () => {
		expect(mapAvailabilityToGoogle("preorder")).toBe("preorder");
	});
	it("defaults to in_stock for unknown values", () => {
		expect(mapAvailabilityToGoogle("unknown" as "in-stock")).toBe("in_stock");
	});
});

describe("mapProductStatusToInternal", () => {
	it("returns active when all destinations are approved", () => {
		expect(
			mapProductStatusToInternal([
				{ destination: "Shopping", status: "approved" },
				{ destination: "SurfacesAcrossGoogle", status: "approved" },
			]),
		).toBe("active");
	});

	it("returns disapproved when any destination is disapproved", () => {
		expect(
			mapProductStatusToInternal([
				{ destination: "Shopping", status: "approved" },
				{ destination: "SurfacesAcrossGoogle", status: "disapproved" },
			]),
		).toBe("disapproved");
	});

	it("returns pending when destinations are mixed approved/pending", () => {
		expect(
			mapProductStatusToInternal([
				{ destination: "Shopping", status: "approved" },
				{ destination: "SurfacesAcrossGoogle", status: "pending" },
			]),
		).toBe("pending");
	});

	it("returns pending for all-pending destinations", () => {
		expect(
			mapProductStatusToInternal([
				{ destination: "Shopping", status: "pending" },
			]),
		).toBe("pending");
	});

	it("returns disapproved over pending when both exist", () => {
		expect(
			mapProductStatusToInternal([
				{ destination: "Shopping", status: "disapproved" },
				{ destination: "SurfacesAcrossGoogle", status: "pending" },
			]),
		).toBe("disapproved");
	});

	it("returns active for empty destinations array", () => {
		expect(mapProductStatusToInternal([])).toBe("active");
	});
});
