import { createMockDataService } from "@86d-app/core/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	GoogleProduct,
	GoogleProductStatusesListResponse,
} from "../provider";
import { createGoogleShoppingController } from "../service-impl";

// ── Realistic Google Content API v2.1 fixtures ──────────────────────────────

const INSERTED_PRODUCT_RESPONSE: GoogleProduct = {
	id: "online:en:US:prod-1",
	offerId: "prod-1",
	title: "Premium Widget",
	description: "A high-quality widget",
	link: "https://store.example.com/widget",
	imageLink: "https://store.example.com/images/widget.jpg",
	contentLanguage: "en",
	targetCountry: "US",
	channel: "online",
	availability: "in_stock",
	condition: "new",
	price: { value: "29.99", currency: "USD" },
	brand: "WidgetCo",
};

const STATUSES_WITH_ISSUES: GoogleProductStatusesListResponse = {
	kind: "content#productstatusesListResponse",
	resources: [
		{
			productId: "online:en:US:prod-1",
			title: "Premium Widget",
			destinationStatuses: [
				{ destination: "SurfacesAcrossGoogle", status: "approved" },
				{ destination: "Shopping", status: "approved" },
			],
			itemLevelIssues: [],
		},
		{
			productId: "online:en:US:prod-2",
			title: "Broken Gadget",
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
					description: "Image link is broken or returns an error",
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
			productId: "online:en:US:prod-3",
			title: "New Accessory",
			destinationStatuses: [
				{ destination: "SurfacesAcrossGoogle", status: "pending" },
			],
			itemLevelIssues: [],
		},
	],
};

const EMPTY_STATUSES: GoogleProductStatusesListResponse = {
	kind: "content#productstatusesListResponse",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockFetch(body: unknown, ok = true, status = 200) {
	const mock = vi.fn().mockResolvedValue({
		ok,
		status,
		json: () => Promise.resolve(body),
	});
	globalThis.fetch = mock;
	return mock;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("google-shopping service-impl (provider integration)", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		mockData = createMockDataService();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	// ── pushProduct ─────────────────────────────────────────────────────

	describe("pushProduct", () => {
		it("pushes a feed item to Google Merchant Center and updates local status", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			const item = await controller.createFeedItem({
				localProductId: "prod-1",
				title: "Premium Widget",
				description: "A high-quality widget",
				price: 29.99,
				link: "https://store.example.com/widget",
				imageLink: "https://store.example.com/images/widget.jpg",
				brand: "WidgetCo",
				gtin: "012345678905",
				condition: "new",
				availability: "in-stock",
			});

			const mock = mockFetch(INSERTED_PRODUCT_RESPONSE);

			const result = await controller.pushProduct(item.id);

			expect(result).not.toBeNull();
			expect(result?.googleProductId).toBe("online:en:US:prod-1");
			expect(result?.status).toBe("active");
			expect(result?.lastSyncedAt).toBeInstanceOf(Date);

			// Verify the API was called with correct product shape
			const [url, options] = mock.mock.calls[0];
			expect(url).toContain("shoppingcontent.googleapis.com");
			expect(url).toContain("/123456789/products");
			expect(options.method).toBe("POST");

			const body = JSON.parse(options.body);
			expect(body.offerId).toBe("prod-1");
			expect(body.title).toBe("Premium Widget");
			expect(body.price).toEqual({ value: "29.99", currency: "USD" });
			expect(body.availability).toBe("in_stock");
			expect(body.condition).toBe("new");
			expect(body.contentLanguage).toBe("en");
			expect(body.targetCountry).toBe("US");
			expect(body.channel).toBe("online");
			expect(body.brand).toBe("WidgetCo");
			expect(body.gtin).toBe("012345678905");
		});

		it("sends salePrice when present on feed item", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			const item = await controller.createFeedItem({
				localProductId: "prod-sale",
				title: "Sale Widget",
				price: 39.99,
				salePrice: 29.99,
				link: "https://store.example.com/sale",
				imageLink: "https://store.example.com/sale.jpg",
			});

			const mock = mockFetch({
				...INSERTED_PRODUCT_RESPONSE,
				offerId: "prod-sale",
			});

			await controller.pushProduct(item.id);

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.salePrice).toEqual({ value: "29.99", currency: "USD" });
		});

		it("omits optional fields when not set on feed item", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			const item = await controller.createFeedItem({
				localProductId: "prod-minimal",
				title: "Minimal Product",
				price: 9.99,
				link: "https://store.example.com/min",
				imageLink: "https://store.example.com/min.jpg",
			});

			const mock = mockFetch({
				...INSERTED_PRODUCT_RESPONSE,
				offerId: "prod-minimal",
			});

			await controller.pushProduct(item.id);

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.gtin).toBeUndefined();
			expect(body.mpn).toBeUndefined();
			expect(body.brand).toBeUndefined();
			expect(body.salePrice).toBeUndefined();
			expect(body.googleProductCategory).toBeUndefined();
		});

		it("sends googleProductCategory when googleCategory is set", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			const item = await controller.createFeedItem({
				localProductId: "prod-cat",
				title: "Categorized Product",
				price: 15,
				link: "https://store.example.com/cat",
				imageLink: "https://store.example.com/cat.jpg",
				googleCategory: "Apparel & Accessories > Shoes",
			});

			const mock = mockFetch({
				...INSERTED_PRODUCT_RESPONSE,
				offerId: "prod-cat",
			});

			await controller.pushProduct(item.id);

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.googleProductCategory).toBe("Apparel & Accessories > Shoes");
		});

		it("uses custom targetCountry and contentLanguage from options", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
				targetCountry: "GB",
				contentLanguage: "en-GB",
			});

			const item = await controller.createFeedItem({
				localProductId: "prod-uk",
				title: "UK Widget",
				price: 19.99,
				link: "https://store.example.co.uk/widget",
				imageLink: "https://store.example.co.uk/widget.jpg",
			});

			const mock = mockFetch({
				...INSERTED_PRODUCT_RESPONSE,
				offerId: "prod-uk",
			});

			await controller.pushProduct(item.id);

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.targetCountry).toBe("GB");
			expect(body.contentLanguage).toBe("en-GB");
		});

		it("maps out-of-stock availability to Google format", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			const item = await controller.createFeedItem({
				localProductId: "prod-oos",
				title: "Out of Stock Item",
				price: 10,
				link: "https://store.example.com/oos",
				imageLink: "https://store.example.com/oos.jpg",
				availability: "out-of-stock",
			});

			const mock = mockFetch({
				...INSERTED_PRODUCT_RESPONSE,
				availability: "out_of_stock",
			});

			await controller.pushProduct(item.id);

			const body = JSON.parse(mock.mock.calls[0][1].body);
			expect(body.availability).toBe("out_of_stock");
		});

		it("returns null when feed item does not exist", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			const result = await controller.pushProduct("nonexistent-id");
			expect(result).toBeNull();
		});

		it("returns null when provider is not configured", async () => {
			const controller = createGoogleShoppingController(mockData);

			const item = await controller.createFeedItem({
				localProductId: "prod-1",
				title: "Widget",
				price: 10,
				link: "https://example.com/widget",
				imageLink: "https://example.com/widget.jpg",
			});

			const result = await controller.pushProduct(item.id);
			expect(result).toBeNull();
		});

		it("returns null when merchantId is set but apiKey is missing", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
			});

			const item = await controller.createFeedItem({
				localProductId: "prod-1",
				title: "Widget",
				price: 10,
				link: "https://example.com/widget",
				imageLink: "https://example.com/widget.jpg",
			});

			const result = await controller.pushProduct(item.id);
			expect(result).toBeNull();
		});

		it("persists updated feed item after push", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			const item = await controller.createFeedItem({
				localProductId: "prod-persist",
				title: "Persist Test",
				price: 20,
				link: "https://store.example.com/persist",
				imageLink: "https://store.example.com/persist.jpg",
			});

			expect(item.status).toBe("pending");
			expect(item.lastSyncedAt).toBeUndefined();

			mockFetch({
				...INSERTED_PRODUCT_RESPONSE,
				id: "online:en:US:prod-persist",
			});

			await controller.pushProduct(item.id);

			const fetched = await controller.getFeedItem(item.id);
			expect(fetched?.status).toBe("active");
			expect(fetched?.googleProductId).toBe("online:en:US:prod-persist");
			expect(fetched?.lastSyncedAt).toBeInstanceOf(Date);
		});
	});

	// ── syncProducts ────────────────────────────────────────────────────

	describe("syncProducts", () => {
		it("syncs product statuses from Google Merchant Center", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			// Create feed items that match the Google product IDs
			const item1 = await controller.createFeedItem({
				localProductId: "prod-1",
				googleProductId: "online:en:US:prod-1",
				title: "Premium Widget",
				price: 29.99,
				link: "https://store.example.com/widget",
				imageLink: "https://store.example.com/images/widget.jpg",
			});

			const item2 = await controller.createFeedItem({
				localProductId: "prod-2",
				googleProductId: "online:en:US:prod-2",
				title: "Broken Gadget",
				price: 49.99,
				link: "https://store.example.com/gadget",
				imageLink: "https://store.example.com/images/gadget.jpg",
			});

			const item3 = await controller.createFeedItem({
				localProductId: "prod-3",
				googleProductId: "online:en:US:prod-3",
				title: "New Accessory",
				price: 19.99,
				link: "https://store.example.com/accessory",
				imageLink: "https://store.example.com/images/accessory.jpg",
			});

			mockFetch(STATUSES_WITH_ISSUES);

			const result = await controller.syncProducts();
			expect(result.synced).toBe(3);

			// Item 1: approved → active
			const synced1 = await controller.getFeedItem(item1.id);
			expect(synced1?.status).toBe("active");
			expect(synced1?.lastSyncedAt).toBeInstanceOf(Date);

			// Item 2: disapproved with reasons
			const synced2 = await controller.getFeedItem(item2.id);
			expect(synced2?.status).toBe("disapproved");
			expect(synced2?.disapprovalReasons).toEqual([
				"Image link is broken or returns an error",
			]);
			expect(synced2?.lastSyncedAt).toBeInstanceOf(Date);

			// Item 3: pending
			const synced3 = await controller.getFeedItem(item3.id);
			expect(synced3?.status).toBe("pending");
			expect(synced3?.lastSyncedAt).toBeInstanceOf(Date);
		});

		it("only counts disapproved issues (not demoted)", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			await controller.createFeedItem({
				localProductId: "prod-2",
				googleProductId: "online:en:US:prod-2",
				title: "Broken Gadget",
				price: 49.99,
				link: "https://store.example.com/gadget",
				imageLink: "https://store.example.com/images/gadget.jpg",
			});

			mockFetch(STATUSES_WITH_ISSUES);

			await controller.syncProducts();

			// The fixture has one "disapproved" issue and one "demoted" issue
			// Only "disapproved" issues should appear in disapprovalReasons
			const items = await controller.listFeedItems();
			const gadget = items.find((i) => i.localProductId === "prod-2");
			expect(gadget?.disapprovalReasons).toEqual([
				"Image link is broken or returns an error",
			]);
			expect(gadget?.disapprovalReasons).not.toContain(
				"Missing GTIN for this product",
			);
		});

		it("skips products not in local feed", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			// Only create one item, while the API returns 3 statuses
			await controller.createFeedItem({
				localProductId: "prod-1",
				googleProductId: "online:en:US:prod-1",
				title: "Widget",
				price: 29.99,
				link: "https://store.example.com/widget",
				imageLink: "https://store.example.com/images/widget.jpg",
			});

			mockFetch(STATUSES_WITH_ISSUES);

			const result = await controller.syncProducts();
			expect(result.synced).toBe(1);
		});

		it("handles empty statuses response", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			mockFetch(EMPTY_STATUSES);

			const result = await controller.syncProducts();
			expect(result.synced).toBe(0);
		});

		it("returns zero synced when provider is not configured", async () => {
			const controller = createGoogleShoppingController(mockData);

			const result = await controller.syncProducts();
			expect(result).toEqual({ synced: 0 });
		});

		it("preserves existing disapproval reasons when no new issues found", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			// Create item with existing disapproval reasons
			const item = await controller.createFeedItem({
				localProductId: "prod-1",
				googleProductId: "online:en:US:prod-1",
				title: "Widget",
				price: 29.99,
				link: "https://store.example.com/widget",
				imageLink: "https://store.example.com/images/widget.jpg",
				status: "disapproved",
				disapprovalReasons: ["Old reason from previous sync"],
			});

			// The status response for prod-1 shows it's now approved with no issues
			mockFetch(STATUSES_WITH_ISSUES);

			await controller.syncProducts();

			const synced = await controller.getFeedItem(item.id);
			expect(synced?.status).toBe("active");
			// When no new disapproved issues, keeps existing reasons
			expect(synced?.disapprovalReasons).toEqual([
				"Old reason from previous sync",
			]);
		});

		it("calls correct API endpoint for statuses", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			const mock = mockFetch(EMPTY_STATUSES);

			await controller.syncProducts();

			const [url] = mock.mock.calls[0];
			expect(url).toContain("/123456789/productstatuses");
			expect(url).toContain("key=test-key");
		});
	});

	// ── submitFeed ──────────────────────────────────────────────────────

	describe("submitFeed", () => {
		it("pushes all feed items to Google and returns completed submission", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			await controller.createFeedItem({
				localProductId: "prod-1",
				title: "Widget A",
				price: 10,
				link: "https://store.example.com/a",
				imageLink: "https://store.example.com/a.jpg",
			});
			await controller.createFeedItem({
				localProductId: "prod-2",
				title: "Widget B",
				price: 20,
				link: "https://store.example.com/b",
				imageLink: "https://store.example.com/b.jpg",
			});

			// First two calls: insertProduct for each item
			// Third call: listProductStatuses for approval counts
			let callCount = 0;
			globalThis.fetch = vi.fn().mockImplementation(() => {
				callCount++;
				if (callCount <= 2) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve({
								...INSERTED_PRODUCT_RESPONSE,
								id: `online:en:US:prod-${callCount}`,
								offerId: `prod-${callCount}`,
							}),
					});
				}
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve(STATUSES_WITH_ISSUES),
				});
			});

			const result = await controller.submitFeed();

			expect(result.status).toBe("completed");
			expect(result.totalProducts).toBe(2);
			expect(result.completedAt).toBeInstanceOf(Date);
			expect(result.error).toBeUndefined();
			// 3 calls: 2 insertProduct + 1 listProductStatuses
			expect(callCount).toBe(3);
		});

		it("returns pending submission when provider is not configured", async () => {
			const controller = createGoogleShoppingController(mockData);

			await controller.createFeedItem({
				localProductId: "prod-1",
				title: "Widget",
				price: 10,
				link: "https://store.example.com/w",
				imageLink: "https://store.example.com/w.jpg",
			});

			const result = await controller.submitFeed();

			expect(result.status).toBe("pending");
			expect(result.totalProducts).toBe(1);
			expect(result.approvedProducts).toBe(0);
			expect(result.completedAt).toBeUndefined();
		});

		it("returns processing submission with zero products immediately", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			const result = await controller.submitFeed();

			expect(result.status).toBe("processing");
			expect(result.totalProducts).toBe(0);
		});

		it("handles partial failures and reports error", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			await controller.createFeedItem({
				localProductId: "prod-ok",
				title: "Good Widget",
				price: 10,
				link: "https://store.example.com/ok",
				imageLink: "https://store.example.com/ok.jpg",
			});
			await controller.createFeedItem({
				localProductId: "prod-bad",
				title: "Bad Widget",
				price: 20,
				link: "https://store.example.com/bad",
				imageLink: "https://store.example.com/bad.jpg",
			});

			let callCount = 0;
			globalThis.fetch = vi.fn().mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve({
								...INSERTED_PRODUCT_RESPONSE,
								id: "online:en:US:prod-ok",
							}),
					});
				}
				if (callCount === 2) {
					return Promise.resolve({
						ok: false,
						status: 400,
						json: () =>
							Promise.resolve({ error: { message: "Invalid product" } }),
					});
				}
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve(EMPTY_STATUSES),
				});
			});

			const result = await controller.submitFeed();

			expect(result.status).toBe("completed");
			expect(result.error).toBe("1 of 2 products failed to submit");
		});

		it("returns failed submission when all items fail", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			await controller.createFeedItem({
				localProductId: "prod-1",
				title: "Widget",
				price: 10,
				link: "https://store.example.com/w",
				imageLink: "https://store.example.com/w.jpg",
			});

			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				json: () => Promise.resolve({ error: { message: "Server error" } }),
			});

			const result = await controller.submitFeed();

			expect(result.status).toBe("failed");
			expect(result.error).toBe("1 of 1 products failed to submit");
		});

		it("updates local feed items with Google IDs after push", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			const item = await controller.createFeedItem({
				localProductId: "prod-1",
				title: "Widget",
				price: 10,
				link: "https://store.example.com/w",
				imageLink: "https://store.example.com/w.jpg",
			});

			expect(item.googleProductId).toBeUndefined();
			expect(item.status).toBe("pending");

			let callCount = 0;
			globalThis.fetch = vi.fn().mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () =>
							Promise.resolve({
								...INSERTED_PRODUCT_RESPONSE,
								id: "online:en:US:prod-1",
							}),
					});
				}
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve(EMPTY_STATUSES),
				});
			});

			await controller.submitFeed();

			const updated = await controller.getFeedItem(item.id);
			expect(updated?.googleProductId).toBe("online:en:US:prod-1");
			expect(updated?.status).toBe("active");
			expect(updated?.lastSyncedAt).toBeInstanceOf(Date);
		});

		it("uses approval counts from Google status API", async () => {
			const controller = createGoogleShoppingController(mockData, undefined, {
				merchantId: "123456789",
				apiKey: "test-key",
			});

			await controller.createFeedItem({
				localProductId: "prod-1",
				title: "Widget",
				price: 10,
				link: "https://store.example.com/w",
				imageLink: "https://store.example.com/w.jpg",
			});

			let callCount = 0;
			globalThis.fetch = vi.fn().mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					return Promise.resolve({
						ok: true,
						status: 200,
						json: () => Promise.resolve(INSERTED_PRODUCT_RESPONSE),
					});
				}
				// Status API returns 1 approved + 1 disapproved + 1 pending
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve(STATUSES_WITH_ISSUES),
				});
			});

			const result = await controller.submitFeed();

			expect(result.approvedProducts).toBe(1);
			expect(result.disapprovedProducts).toBe(1);
		});
	});
});
