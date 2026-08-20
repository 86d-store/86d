import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	formatPinterestPrice,
	mapAvailabilityToPinterest,
	PinterestApiProvider,
	verifyWebhookSignature,
} from "../provider";

// ── Realistic Pinterest API v5 response fixtures ─────────────────────────────

const BATCH_UPSERT_RESPONSE = {
	batch_id: "5189842903846102",
	status: "PENDING",
	created_time: "2024-07-15T10:30:00Z",
	total_count: 3,
	success_count: 0,
	failure_count: 0,
};

const BATCH_DELETE_RESPONSE = {
	batch_id: "5189842903846103",
	status: "PENDING",
	created_time: "2024-07-15T11:00:00Z",
	total_count: 2,
	success_count: 0,
	failure_count: 0,
};

const BATCH_STATUS_COMPLETED = {
	batch_id: "5189842903846102",
	status: "COMPLETED",
	created_time: "2024-07-15T10:30:00Z",
	completed_time: "2024-07-15T10:32:15Z",
	total_count: 3,
	success_count: 3,
	failure_count: 0,
	items: [
		{ item_id: "prod-001", status: "SUCCESS" },
		{ item_id: "prod-002", status: "SUCCESS" },
		{ item_id: "prod-003", status: "SUCCESS" },
	],
};

const BATCH_STATUS_PARTIAL_FAILURE = {
	batch_id: "5189842903846104",
	status: "COMPLETED",
	created_time: "2024-07-15T12:00:00Z",
	completed_time: "2024-07-15T12:02:30Z",
	total_count: 2,
	success_count: 1,
	failure_count: 1,
	items: [
		{ item_id: "prod-001", status: "SUCCESS" },
		{
			item_id: "prod-004",
			status: "FAILURE",
			errors: [{ message: "Invalid image URL: must be HTTPS" }],
		},
	],
};

const CATALOG_ITEMS_RESPONSE = {
	items: [
		{
			item_id: "prod-001",
			title: "Organic Cotton T-Shirt",
			description: "Soft organic cotton t-shirt in classic fit",
			link: "https://store.example.com/products/organic-tee",
			image_link: "https://cdn.example.com/images/organic-tee.jpg",
			price: "29.99 USD",
			availability: "in stock",
			google_product_category: "Apparel & Accessories > Clothing > Shirts",
		},
		{
			item_id: "prod-002",
			title: "Denim Jacket",
			description: "Classic denim jacket with brass buttons",
			link: "https://store.example.com/products/denim-jacket",
			image_link: "https://cdn.example.com/images/denim-jacket.jpg",
			price: "89.99 USD",
			sale_price: "69.99 USD",
			availability: "in stock",
			google_product_category: "Apparel & Accessories > Clothing > Outerwear",
		},
	],
	bookmark: "bmk_eyJvZmZzZXQiOjJ9",
};

const LIST_CATALOGS_RESPONSE = {
	items: [
		{
			id: "2680195032751",
			name: "My Store Catalog",
			catalog_type: "RETAIL",
			created_at: "2024-01-10T08:15:00Z",
			updated_at: "2024-07-15T10:00:00Z",
			status: "ACTIVE",
		},
	],
};

const CREATE_PIN_RESPONSE = {
	id: "1047714940382012983",
	title: "Organic Cotton T-Shirt - Shop Now",
	description: "Soft organic cotton in classic fit. Free shipping.",
	link: "https://store.example.com/products/organic-tee",
	board_id: "851842938741283",
	media: {
		images: {
			"600x": {
				url: "https://i.pinimg.com/600x/ab/cd/ef/abcdef123456.jpg",
				width: 600,
				height: 800,
			},
		},
	},
	created_at: "2024-07-15T14:30:00Z",
};

const GET_PIN_RESPONSE = {
	id: "1047714940382012983",
	title: "Organic Cotton T-Shirt - Shop Now",
	description: "Soft organic cotton in classic fit. Free shipping.",
	link: "https://store.example.com/products/organic-tee",
	board_id: "851842938741283",
	media: {
		images: {
			"600x": {
				url: "https://i.pinimg.com/600x/ab/cd/ef/abcdef123456.jpg",
				width: 600,
				height: 800,
			},
		},
	},
	created_at: "2024-07-15T14:30:00Z",
};

const PIN_ANALYTICS_RESPONSE = {
	all: {
		lifetime_metrics: {
			IMPRESSION: 12480,
			SAVE: 342,
			PIN_CLICK: 1856,
			OUTBOUND_CLICK: 924,
		},
		daily_metrics: [
			{
				date: "2024-07-14",
				data_status: "READY",
				metrics: {
					IMPRESSION: 1250,
					SAVE: 38,
					PIN_CLICK: 187,
					OUTBOUND_CLICK: 93,
				},
			},
			{
				date: "2024-07-15",
				data_status: "READY",
				metrics: {
					IMPRESSION: 980,
					SAVE: 29,
					PIN_CLICK: 142,
					OUTBOUND_CLICK: 71,
				},
			},
		],
	},
};

const PINTEREST_ERROR_RESPONSE = {
	code: 403,
	message: "Not authorized to access the user account.",
};

const PINTEREST_RATE_LIMIT_RESPONSE = {
	code: 429,
	message: "Rate limit exceeded. Please retry after 60 seconds.",
};

// ── Provider tests ───────────────────────────────────────────────────────────

describe("PinterestApiProvider", () => {
	let provider: PinterestApiProvider;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		provider = new PinterestApiProvider({
			accessToken: "pina_AaBbCcDdEeFfGgHh1234567890",
			adAccountId: "549764106778",
			catalogId: "2680195032751",
		});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	function mockFetch(response: unknown, status = 200) {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: status >= 200 && status < 300,
			status,
			json: () => Promise.resolve(response),
		});
	}

	// ── Verify connection ──

	describe("verifyConnection", () => {
		const USER_ACCOUNT_RESPONSE = {
			account_type: "BUSINESS",
			profile_image: "https://i.pinimg.com/avatar.jpg",
			website_url: "https://store.example.com",
			username: "examplestore",
			about: "Example store on Pinterest",
			business_name: "Example Store",
			board_count: 12,
			pin_count: 340,
			follower_count: 2500,
			following_count: 180,
			monthly_views: 45000,
		};

		it("returns ok with username and account type on success", async () => {
			mockFetch(USER_ACCOUNT_RESPONSE);
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: true,
				username: "examplestore",
				accountType: "BUSINESS",
			});

			const call = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(call[0]).toBe("https://api.pinterest.com/v5/user_account");
			expect(call[1]?.method).toBe("GET");
			expect(call[1]?.headers).toEqual({
				Authorization: "Bearer pina_AaBbCcDdEeFfGgHh1234567890",
				"Content-Type": "application/json",
			});
		});

		it("defaults accountType to PINNER when absent", async () => {
			mockFetch({ username: "casualpinner" });
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: true,
				username: "casualpinner",
				accountType: "PINNER",
			});
		});

		it("returns error with Pinterest message on 401", async () => {
			mockFetch(
				{
					code: 2,
					message: "Authentication failed.",
				},
				401,
			);
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "Authentication failed.",
			});
		});

		it("returns error with Pinterest message on 403", async () => {
			mockFetch(PINTEREST_ERROR_RESPONSE, 403);
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "Not authorized to access the user account.",
			});
		});

		it("returns error with HTTP status when body is not JSON", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
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
			globalThis.fetch = vi
				.fn()
				.mockRejectedValue(new Error("network unreachable"));
			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "network unreachable",
			});
		});
	});

	// ── Catalogs ──

	describe("listCatalogs", () => {
		it("fetches catalogs with correct auth header", async () => {
			mockFetch(LIST_CATALOGS_RESPONSE);
			const result = await provider.listCatalogs();

			expect(result.items).toHaveLength(1);
			expect(result.items[0].id).toBe("2680195032751");
			expect(result.items[0].catalog_type).toBe("RETAIL");

			const call = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(call[0]).toBe("https://api.pinterest.com/v5/catalogs");
			expect(call[1]?.headers).toEqual({
				Authorization: "Bearer pina_AaBbCcDdEeFfGgHh1234567890",
				"Content-Type": "application/json",
			});
		});
	});

	// ── Batch catalog items ──

	describe("batchUpsertItems", () => {
		it("sends UPSERT batch with correctly formatted items", async () => {
			mockFetch(BATCH_UPSERT_RESPONSE);
			const result = await provider.batchUpsertItems([
				{
					itemId: "prod-001",
					title: "Organic Cotton T-Shirt",
					description: "Soft organic cotton t-shirt",
					link: "https://store.example.com/products/organic-tee",
					imageLink: "https://cdn.example.com/images/organic-tee.jpg",
					price: "29.99 USD",
					availability: "in stock",
					googleProductCategory: "Apparel & Accessories > Clothing > Shirts",
				},
				{
					itemId: "prod-002",
					title: "Denim Jacket",
					description: "Classic denim jacket",
					link: "https://store.example.com/products/denim-jacket",
					imageLink: "https://cdn.example.com/images/denim-jacket.jpg",
					price: "89.99 USD",
					salePrice: "69.99 USD",
					availability: "in stock",
				},
			]);

			expect(result.batch_id).toBe("5189842903846102");
			expect(result.status).toBe("PENDING");
			expect(result.total_count).toBe(3);

			const call = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(call[0]).toBe("https://api.pinterest.com/v5/catalogs/items/batch");
			expect(call[1]?.method).toBe("POST");

			const body = JSON.parse(call[1]?.body as string);
			expect(body.catalog_type).toBe("RETAIL");
			expect(body.operation).toBe("UPSERT");
			expect(body.country).toBe("US");
			expect(body.language).toBe("en");
			expect(body.items).toHaveLength(2);
			expect(body.items[0].item_id).toBe("prod-001");
			expect(body.items[0].attributes.title).toBe("Organic Cotton T-Shirt");
			expect(body.items[0].attributes.image_link).toBe(
				"https://cdn.example.com/images/organic-tee.jpg",
			);
			expect(body.items[1].attributes.sale_price).toBe("69.99 USD");
		});

		it("omits optional fields when not provided", async () => {
			mockFetch(BATCH_UPSERT_RESPONSE);
			await provider.batchUpsertItems([
				{
					itemId: "prod-003",
					title: "Basic Tee",
					description: "",
					link: "https://store.example.com/products/basic-tee",
					imageLink: "https://cdn.example.com/images/basic-tee.jpg",
					price: "14.99 USD",
					availability: "in stock",
				},
			]);

			const body = JSON.parse(
				(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string) ?? "{}",
			);
			expect(body.items[0].attributes.sale_price).toBeUndefined();
			expect(body.items[0].attributes.google_product_category).toBeUndefined();
		});

		it("uses custom country and language", async () => {
			mockFetch(BATCH_UPSERT_RESPONSE);
			await provider.batchUpsertItems(
				[
					{
						itemId: "prod-fr",
						title: "T-Shirt Bio",
						description: "T-shirt en coton bio",
						link: "https://store.example.fr/products/bio-tee",
						imageLink: "https://cdn.example.fr/images/bio-tee.jpg",
						price: "29.99 EUR",
						availability: "in stock",
					},
				],
				"FR",
				"fr",
			);

			const body = JSON.parse(
				(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string) ?? "{}",
			);
			expect(body.country).toBe("FR");
			expect(body.language).toBe("fr");
		});
	});

	describe("batchDeleteItems", () => {
		it("sends DELETE batch for given item IDs", async () => {
			mockFetch(BATCH_DELETE_RESPONSE);
			const result = await provider.batchDeleteItems(["prod-001", "prod-002"]);

			expect(result.batch_id).toBe("5189842903846103");

			const body = JSON.parse(
				(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string) ?? "{}",
			);
			expect(body.operation).toBe("DELETE");
			expect(body.items).toHaveLength(2);
			expect(body.items[0].item_id).toBe("prod-001");
			expect(body.items[1].item_id).toBe("prod-002");
		});
	});

	describe("getBatchStatus", () => {
		it("returns completed batch with item statuses", async () => {
			mockFetch(BATCH_STATUS_COMPLETED);
			const result = await provider.getBatchStatus("5189842903846102");

			expect(result.status).toBe("COMPLETED");
			expect(result.success_count).toBe(3);
			expect(result.failure_count).toBe(0);
			expect(result.items).toHaveLength(3);

			const call = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(call[0]).toBe(
				"https://api.pinterest.com/v5/catalogs/items/batch/5189842903846102",
			);
		});

		it("returns partial failure details", async () => {
			mockFetch(BATCH_STATUS_PARTIAL_FAILURE);
			const result = await provider.getBatchStatus("5189842903846104");

			expect(result.failure_count).toBe(1);
			expect(result.items?.[1].status).toBe("FAILURE");
			expect(result.items?.[1].errors?.[0].message).toBe(
				"Invalid image URL: must be HTTPS",
			);
		});
	});

	describe("getCatalogItems", () => {
		it("fetches items with correct query parameters", async () => {
			mockFetch(CATALOG_ITEMS_RESPONSE);
			const result = await provider.getCatalogItems(["prod-001", "prod-002"]);

			expect(result.items).toHaveLength(2);
			expect(result.items[0].item_id).toBe("prod-001");
			expect(result.items[0].price).toBe("29.99 USD");
			expect(result.bookmark).toBe("bmk_eyJvZmZzZXQiOjJ9");

			const call = vi.mocked(globalThis.fetch).mock.calls[0];
			const url = call[0] as string;
			expect(url).toContain("country=US");
			expect(url).toContain("language=en");
			expect(url).toContain("item_ids=prod-001%2Cprod-002");
		});
	});

	// ── Pins ──

	describe("createPin", () => {
		it("creates a pin with image_url media source", async () => {
			mockFetch(CREATE_PIN_RESPONSE);
			const result = await provider.createPin({
				title: "Organic Cotton T-Shirt - Shop Now",
				description: "Soft organic cotton in classic fit. Free shipping.",
				link: "https://store.example.com/products/organic-tee",
				board_id: "851842938741283",
				media_source: {
					source_type: "image_url",
					url: "https://cdn.example.com/images/organic-tee.jpg",
				},
			});

			expect(result.id).toBe("1047714940382012983");
			expect(result.title).toBe("Organic Cotton T-Shirt - Shop Now");
			expect(result.board_id).toBe("851842938741283");

			const call = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(call[0]).toBe("https://api.pinterest.com/v5/pins");
			expect(call[1]?.method).toBe("POST");

			const body = JSON.parse(call[1]?.body as string);
			expect(body.media_source.source_type).toBe("image_url");
		});

		it("creates a pin without optional fields", async () => {
			mockFetch(CREATE_PIN_RESPONSE);
			await provider.createPin({
				title: "Shop Now",
				link: "https://store.example.com",
				media_source: {
					source_type: "image_url",
					url: "https://cdn.example.com/images/hero.jpg",
				},
			});

			const body = JSON.parse(
				(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string) ?? "{}",
			);
			expect(body.description).toBeUndefined();
			expect(body.board_id).toBeUndefined();
		});
	});

	describe("getPin", () => {
		it("fetches a pin by ID", async () => {
			mockFetch(GET_PIN_RESPONSE);
			const result = await provider.getPin("1047714940382012983");

			expect(result.id).toBe("1047714940382012983");
			expect(result.title).toBe("Organic Cotton T-Shirt - Shop Now");

			const call = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(call[0]).toBe(
				"https://api.pinterest.com/v5/pins/1047714940382012983",
			);
			expect(call[1]?.method).toBe("GET");
		});
	});

	describe("deletePin", () => {
		it("deletes a pin by ID", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 204,
				json: () => Promise.resolve(undefined),
			});
			await provider.deletePin("1047714940382012983");

			const call = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(call[0]).toBe(
				"https://api.pinterest.com/v5/pins/1047714940382012983",
			);
			expect(call[1]?.method).toBe("DELETE");
		});
	});

	describe("getPinAnalytics", () => {
		it("fetches analytics with date range and metrics", async () => {
			mockFetch(PIN_ANALYTICS_RESPONSE);
			const result = await provider.getPinAnalytics(
				"1047714940382012983",
				"2024-07-01",
				"2024-07-15",
			);

			expect(result.all.lifetime_metrics.IMPRESSION).toBe(12480);
			expect(result.all.lifetime_metrics.SAVE).toBe(342);
			expect(result.all.lifetime_metrics.PIN_CLICK).toBe(1856);
			expect(result.all.lifetime_metrics.OUTBOUND_CLICK).toBe(924);
			expect(result.all.daily_metrics).toHaveLength(2);

			const call = vi.mocked(globalThis.fetch).mock.calls[0];
			const url = call[0] as string;
			expect(url).toContain("pins/1047714940382012983/analytics");
			expect(url).toContain("start_date=2024-07-01");
			expect(url).toContain("end_date=2024-07-15");
			expect(url).toContain("metric_types=IMPRESSION");
		});
	});

	// ── Error handling ──

	describe("error handling", () => {
		it("throws descriptive error on 403", async () => {
			mockFetch(PINTEREST_ERROR_RESPONSE, 403);
			await expect(provider.listCatalogs()).rejects.toThrow(
				"Pinterest API error: Not authorized to access the user account.",
			);
		});

		it("throws descriptive error on 429 rate limit", async () => {
			mockFetch(PINTEREST_RATE_LIMIT_RESPONSE, 429);
			await expect(
				provider.batchUpsertItems([
					{
						itemId: "x",
						title: "x",
						description: "x",
						link: "https://x.com",
						imageLink: "https://x.com/img.jpg",
						price: "1.00 USD",
						availability: "in stock",
					},
				]),
			).rejects.toThrow("Rate limit exceeded");
		});

		it("throws generic error when response body is not JSON", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				json: () => Promise.reject(new Error("not json")),
			});
			await expect(provider.getPin("xyz")).rejects.toThrow(
				"Pinterest API error (500)",
			);
		});
	});

	// ── Auth header ──

	describe("authentication", () => {
		it("sends Bearer token on every request", async () => {
			mockFetch(LIST_CATALOGS_RESPONSE);
			await provider.listCatalogs();

			mockFetch(CREATE_PIN_RESPONSE);
			await provider.createPin({
				title: "test",
				link: "https://test.com",
				media_source: {
					source_type: "image_url",
					url: "https://test.com/img.jpg",
				},
			});

			for (const call of vi.mocked(globalThis.fetch).mock.calls) {
				const headers = call[1]?.headers as Record<string, string>;
				expect(headers.Authorization).toBe(
					"Bearer pina_AaBbCcDdEeFfGgHh1234567890",
				);
			}
		});
	});
});

// ── Helper function tests ────────────────────────────────────────────────────

describe("mapAvailabilityToPinterest", () => {
	it("maps in-stock to 'in stock'", () => {
		expect(mapAvailabilityToPinterest("in-stock")).toBe("in stock");
	});

	it("maps out-of-stock to 'out of stock'", () => {
		expect(mapAvailabilityToPinterest("out-of-stock")).toBe("out of stock");
	});

	it("maps preorder to 'preorder'", () => {
		expect(mapAvailabilityToPinterest("preorder")).toBe("preorder");
	});

	it("defaults to 'in stock' for unknown values", () => {
		expect(mapAvailabilityToPinterest("discontinued")).toBe("in stock");
	});
});

describe("formatPinterestPrice", () => {
	it("formats price with default USD currency", () => {
		expect(formatPinterestPrice(29.99)).toBe("29.99 USD");
	});

	it("formats price with custom currency", () => {
		expect(formatPinterestPrice(49.5, "EUR")).toBe("49.50 EUR");
	});

	it("pads to two decimal places", () => {
		expect(formatPinterestPrice(100)).toBe("100.00 USD");
	});

	it("handles very small prices", () => {
		expect(formatPinterestPrice(0.01)).toBe("0.01 USD");
	});
});

describe("verifyWebhookSignature", () => {
	it("rejects invalid signatures", () => {
		expect(verifyWebhookSignature("{}", "sha256=invalid", "secret123")).toBe(
			false,
		);
	});

	it("rejects empty signature", () => {
		expect(verifyWebhookSignature("{}", "", "secret123")).toBe(false);
	});

	it("generates and verifies a valid signature", () => {
		const crypto = require("node:crypto");
		const payload = '{"type":"catalog.sync","data":{}}';
		const secret = "whsec_test_123456";
		const hmac = crypto.createHmac("sha256", secret);
		hmac.update(payload);
		const sig = `sha256=${hmac.digest("hex")}`;

		expect(verifyWebhookSignature(payload, sig, secret)).toBe(true);
	});

	it("rejects tampered payloads", () => {
		const crypto = require("node:crypto");
		const original = '{"type":"catalog.sync","data":{}}';
		const tampered = '{"type":"catalog.sync","data":{"hacked":true}}';
		const secret = "whsec_test_123456";
		const hmac = crypto.createHmac("sha256", secret);
		hmac.update(original);
		const sig = `sha256=${hmac.digest("hex")}`;

		expect(verifyWebhookSignature(tampered, sig, secret)).toBe(false);
	});
});
