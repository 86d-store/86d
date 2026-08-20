import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type EtsyApiListing,
	type EtsyApiReceipt,
	type EtsyApiReview,
	type EtsyPaginatedResponse,
	EtsyProvider,
	etsyMoney,
	mapEtsyStateToStatus,
	mapWhoMadeFromApi,
	mapWhoMadeToApi,
} from "../provider";

// ── Realistic Etsy API fixtures ──────────────────────────────────────────────

const MOCK_API_KEY = "kx2a7b9c4d5e6f8g1h3j5k7m";
const MOCK_SHOP_ID = "38472619";
const MOCK_ACCESS_TOKEN = "12345678.AbCdEfGhIjKlMnOpQrStUvWxYz";

const LISTING_FIXTURE: EtsyApiListing = {
	listing_id: 1425836791,
	title: "Handmade Ceramic Coffee Mug - Speckled Stoneware",
	description:
		"Beautiful handmade ceramic coffee mug with speckled stoneware glaze.",
	state: "active",
	price: { amount: 3200, divisor: 100, currency_code: "USD" },
	quantity: 15,
	who_made: "i_did",
	when_made: "2020_2024",
	is_supply: false,
	materials: ["stoneware", "ceramic glaze"],
	tags: ["coffee mug", "handmade", "ceramic", "pottery", "stoneware"],
	taxonomy_id: 1761,
	shipping_profile_id: 195827364,
	views: 342,
	num_favorers: 47,
	url: "https://www.etsy.com/listing/1425836791",
	creation_tsz: 1710500000,
	last_modified_tsz: 1710700000,
	ending_tsz: 1720900000,
};

const DRAFT_LISTING: EtsyApiListing = {
	...LISTING_FIXTURE,
	listing_id: 1425836792,
	title: "New Draft Mug",
	state: "draft",
	views: 0,
	num_favorers: 0,
};

const RECEIPT_FIXTURE: EtsyApiReceipt = {
	receipt_id: 2947381625,
	status: "paid",
	transactions: [
		{
			transaction_id: 3847261953,
			listing_id: 1425836791,
			title: "Handmade Ceramic Coffee Mug - Speckled Stoneware",
			quantity: 2,
			price: { amount: 3200, divisor: 100, currency_code: "USD" },
		},
	],
	name: "Jane Smith",
	buyer_email: "jane@example.com",
	formatted_address: "123 Main St, Portland, OR 97201, US",
	first_line: "123 Main St",
	second_line: null,
	city: "Portland",
	state: "OR",
	zip: "97201",
	country_iso: "US",
	gift_message: "",
	subtotal: { amount: 6400, divisor: 100, currency_code: "USD" },
	total_shipping_cost: { amount: 895, divisor: 100, currency_code: "USD" },
	total_tax_cost: { amount: 512, divisor: 100, currency_code: "USD" },
	total_price: { amount: 7807, divisor: 100, currency_code: "USD" },
	shipping_carrier: null,
	shipping_tracking_code: null,
	shipped_date: null,
	is_shipped: false,
	create_timestamp: 1710600000,
	update_timestamp: 1710600000,
};

const SHIPPED_RECEIPT: EtsyApiReceipt = {
	...RECEIPT_FIXTURE,
	receipt_id: 2947381626,
	status: "completed",
	is_shipped: true,
	shipping_carrier: "usps",
	shipping_tracking_code: "9400111899223456789012",
	shipped_date: 1710700000,
};

const REVIEW_FIXTURE: EtsyApiReview = {
	shop_id: 38472619,
	listing_id: 1425836791,
	transaction_id: 3847261953,
	buyer_user_id: 98765432,
	rating: 5,
	review:
		"Absolutely gorgeous mug! Perfect weight and size for morning coffee.",
	create_timestamp: 1710800000,
	image_url_fullxfull: null,
};

const ERROR_RESPONSE = {
	error: "invalid_token",
	error_description:
		"The access token provided is expired, revoked, or invalid.",
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("EtsyProvider", () => {
	let provider: EtsyProvider;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		provider = new EtsyProvider(MOCK_API_KEY, MOCK_SHOP_ID, MOCK_ACCESS_TOKEN);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	describe("getListings", () => {
		it("sends GET to /application/shops/{shop_id}/listings", async () => {
			const response: EtsyPaginatedResponse<EtsyApiListing> = {
				count: 1,
				results: [LISTING_FIXTURE],
			};
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(response),
			});

			const result = await provider.getListings({ state: "active", limit: 25 });

			expect(result.count).toBe(1);
			expect(result.results[0].listing_id).toBe(1425836791);
			expect(result.results[0].title).toContain("Ceramic Coffee Mug");

			const url = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
			expect(url).toContain(`/application/shops/${MOCK_SHOP_ID}/listings`);
			expect(url).toContain("state=active");
			expect(url).toContain("limit=25");
		});

		it("includes correct auth headers", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ count: 0, results: [] }),
			});

			await provider.getListings();

			const headers = vi.mocked(globalThis.fetch).mock.calls[0][1]
				?.headers as Record<string, string>;
			expect(headers["x-api-key"]).toBe(MOCK_API_KEY);
			expect(headers.Authorization).toBe(`Bearer ${MOCK_ACCESS_TOKEN}`);
			expect(headers["Content-Type"]).toBe("application/json");
		});
	});

	describe("getListing", () => {
		it("sends GET to /application/listings/{listing_id}", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(LISTING_FIXTURE),
			});

			const result = await provider.getListing(1425836791);

			expect(result.listing_id).toBe(1425836791);
			expect(result.price.amount).toBe(3200);

			const url = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
			expect(url).toContain("/application/listings/1425836791");
		});
	});

	describe("createListing", () => {
		it("sends POST to /application/shops/{shop_id}/listings", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(DRAFT_LISTING),
			});

			const result = await provider.createListing({
				title: "New Draft Mug",
				description: "A new mug",
				price: 32.0,
				quantity: 10,
				who_made: "i_did",
				when_made: "2020_2024",
				is_supply: false,
				taxonomy_id: 1761,
				materials: ["stoneware"],
				tags: ["mug", "handmade"],
			});

			expect(result.listing_id).toBe(1425836792);
			expect(result.state).toBe("draft");

			const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(fetchCall[0]).toContain(
				`/application/shops/${MOCK_SHOP_ID}/listings`,
			);
			expect(fetchCall[1]?.method).toBe("POST");

			const body = JSON.parse(fetchCall[1]?.body as string);
			expect(body.title).toBe("New Draft Mug");
			expect(body.who_made).toBe("i_did");
			expect(body.taxonomy_id).toBe(1761);
			expect(body.materials).toEqual(["stoneware"]);
		});
	});

	describe("updateListing", () => {
		it("sends PATCH to /application/shops/{shop_id}/listings/{listing_id}", async () => {
			const updated = { ...LISTING_FIXTURE, quantity: 20 };
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(updated),
			});

			const result = await provider.updateListing(1425836791, {
				quantity: 20,
				tags: ["mug", "handmade", "gift"],
			});

			expect(result.quantity).toBe(20);

			const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(fetchCall[1]?.method).toBe("PATCH");

			const body = JSON.parse(fetchCall[1]?.body as string);
			expect(body.quantity).toBe(20);
			expect(body.tags).toEqual(["mug", "handmade", "gift"]);
			expect(body.title).toBeUndefined();
		});
	});

	describe("deleteListing", () => {
		it("sends DELETE to /application/shops/{shop_id}/listings/{listing_id}", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(undefined),
			});

			await provider.deleteListing(1425836791);

			const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(fetchCall[0]).toContain(
				`/application/shops/${MOCK_SHOP_ID}/listings/1425836791`,
			);
			expect(fetchCall[1]?.method).toBe("DELETE");
		});
	});

	describe("getReceipts", () => {
		it("fetches shop receipts with query params", async () => {
			const response: EtsyPaginatedResponse<EtsyApiReceipt> = {
				count: 2,
				results: [RECEIPT_FIXTURE, SHIPPED_RECEIPT],
			};
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(response),
			});

			const result = await provider.getReceipts({
				was_shipped: false,
				limit: 10,
			});

			expect(result.count).toBe(2);
			expect(result.results[0].name).toBe("Jane Smith");
			expect(result.results[1].is_shipped).toBe(true);

			const url = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
			expect(url).toContain("was_shipped=false");
			expect(url).toContain("limit=10");
		});
	});

	describe("getReceipt", () => {
		it("fetches a single receipt by ID", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(RECEIPT_FIXTURE),
			});

			const result = await provider.getReceipt(2947381625);

			expect(result.receipt_id).toBe(2947381625);
			expect(result.transactions).toHaveLength(1);
			expect(result.transactions[0].title).toContain("Ceramic Coffee Mug");
		});
	});

	describe("createReceiptShipment", () => {
		it("sends POST to /receipts/{id}/tracking", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(SHIPPED_RECEIPT),
			});

			const result = await provider.createReceiptShipment(
				2947381625,
				"9400111899223456789012",
				"usps",
			);

			expect(result.is_shipped).toBe(true);
			expect(result.shipping_tracking_code).toBe("9400111899223456789012");

			const body = JSON.parse(
				vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string,
			);
			expect(body.tracking_code).toBe("9400111899223456789012");
			expect(body.carrier_name).toBe("usps");
		});
	});

	describe("getReviews", () => {
		it("fetches shop reviews", async () => {
			const response: EtsyPaginatedResponse<EtsyApiReview> = {
				count: 1,
				results: [REVIEW_FIXTURE],
			};
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(response),
			});

			const result = await provider.getReviews({ limit: 25 });

			expect(result.count).toBe(1);
			expect(result.results[0].rating).toBe(5);
			expect(result.results[0].review).toContain("gorgeous mug");
		});
	});

	describe("error handling", () => {
		it("throws on API error with error_description", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				json: () => Promise.resolve(ERROR_RESPONSE),
			});

			await expect(provider.getListings()).rejects.toThrow(
				"Etsy API error: The access token provided is expired, revoked, or invalid.",
			);
		});

		it("falls back to error field when no description", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 403,
				json: () => Promise.resolve({ error: "forbidden" }),
			});

			await expect(provider.getListings()).rejects.toThrow(
				"Etsy API error: forbidden",
			);
		});

		it("falls back to HTTP status when no error fields", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				json: () => Promise.resolve({}),
			});

			await expect(provider.getListings()).rejects.toThrow(
				"Etsy API error: HTTP 500",
			);
		});
	});
});

// ── Mapping helper tests ─────────────────────────────────────────────────────

describe("mapEtsyStateToStatus", () => {
	it("maps active to active", () => {
		expect(mapEtsyStateToStatus("active")).toBe("active");
	});
	it("maps draft to draft", () => {
		expect(mapEtsyStateToStatus("draft")).toBe("draft");
	});
	it("maps expired to expired", () => {
		expect(mapEtsyStateToStatus("expired")).toBe("expired");
	});
	it("maps inactive to inactive", () => {
		expect(mapEtsyStateToStatus("inactive")).toBe("inactive");
	});
	it("maps sold_out to sold-out", () => {
		expect(mapEtsyStateToStatus("sold_out")).toBe("sold-out");
	});
});

describe("mapWhoMadeToApi", () => {
	it("converts i-did to i_did", () => {
		expect(mapWhoMadeToApi("i-did")).toBe("i_did");
	});
	it("converts someone-else to someone_else", () => {
		expect(mapWhoMadeToApi("someone-else")).toBe("someone_else");
	});
	it("passes through collective", () => {
		expect(mapWhoMadeToApi("collective")).toBe("collective");
	});
});

describe("mapWhoMadeFromApi", () => {
	it("converts i_did to i-did", () => {
		expect(mapWhoMadeFromApi("i_did")).toBe("i-did");
	});
	it("converts someone_else to someone-else", () => {
		expect(mapWhoMadeFromApi("someone_else")).toBe("someone-else");
	});
	it("passes through collective", () => {
		expect(mapWhoMadeFromApi("collective")).toBe("collective");
	});
});

describe("etsyMoney", () => {
	it("converts 3200/100 to 32.00", () => {
		expect(etsyMoney({ amount: 3200, divisor: 100 })).toBe(32);
	});
	it("converts 895/100 to 8.95", () => {
		expect(etsyMoney({ amount: 895, divisor: 100 })).toBe(8.95);
	});
	it("handles divisor of 1000", () => {
		expect(etsyMoney({ amount: 5000, divisor: 1000 })).toBe(5);
	});
});
