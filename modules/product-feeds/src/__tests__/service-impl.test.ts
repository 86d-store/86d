import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { ProductData, ProductFeedsController } from "../service";
import { createProductFeedsController } from "../service-impl";

// ── Test helpers ─────────────────────────────────────────────────────

function makeProduct(overrides?: Partial<ProductData>): ProductData {
	return {
		id: crypto.randomUUID(),
		title: "Test Product",
		description: "A test product description",
		price: 29.99,
		sku: "SKU-001",
		barcode: "1234567890123",
		brand: "TestBrand",
		category: "Electronics",
		imageUrl: "https://example.com/image.jpg",
		url: "https://example.com/products/test",
		availability: "in_stock",
		condition: "new",
		...overrides,
	};
}

// ── Tests ────────────────────────────────────────────────────────────

describe("createProductFeedsController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ProductFeedsController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createProductFeedsController(mockData);
	});

	// ── Feed CRUD ──────────────────────────────────────────────────

	describe("createFeed", () => {
		it("creates a feed with default mappings for google-shopping", async () => {
			const feed = await controller.createFeed({
				name: "Google US",
				slug: "google-us",
				channel: "google-shopping",
			});

			expect(feed.id).toBeDefined();
			expect(feed.name).toBe("Google US");
			expect(feed.slug).toBe("google-us");
			expect(feed.channel).toBe("google-shopping");
			expect(feed.format).toBe("xml");
			expect(feed.status).toBe("draft");
			expect(feed.fieldMappings.length).toBeGreaterThan(0);
			expect(feed.fieldMappings[0].targetField).toBe("g:id");
		});

		it("creates a feed with default mappings for facebook", async () => {
			const feed = await controller.createFeed({
				name: "Facebook Catalog",
				slug: "fb-catalog",
				channel: "facebook",
			});

			expect(feed.fieldMappings.length).toBeGreaterThan(0);
			expect(feed.fieldMappings[0].targetField).toBe("id");
		});

		it("creates a custom feed with no default mappings", async () => {
			const feed = await controller.createFeed({
				name: "Custom Feed",
				slug: "custom",
				channel: "custom",
			});

			expect(feed.fieldMappings).toEqual([]);
		});

		it("creates a feed with specified format", async () => {
			const feed = await controller.createFeed({
				name: "CSV Feed",
				slug: "csv-feed",
				channel: "google-shopping",
				format: "csv",
			});

			expect(feed.format).toBe("csv");
		});

		it("creates a feed with custom field mappings", async () => {
			const mappings = [
				{ sourceField: "title", targetField: "product_name" },
				{ sourceField: "price", targetField: "product_price" },
			];

			const feed = await controller.createFeed({
				name: "Custom Mapped",
				slug: "custom-mapped",
				channel: "custom",
				fieldMappings: mappings,
			});

			expect(feed.fieldMappings).toEqual(mappings);
		});

		it("creates a feed with filters", async () => {
			const filters = {
				requireImages: true,
				minPrice: 10,
				maxPrice: 1000,
			};

			const feed = await controller.createFeed({
				name: "Filtered",
				slug: "filtered",
				channel: "google-shopping",
				filters,
			});

			expect(feed.filters).toEqual(filters);
		});

		it("creates a feed with locale settings", async () => {
			const feed = await controller.createFeed({
				name: "UK Feed",
				slug: "uk-feed",
				channel: "google-shopping",
				country: "GB",
				currency: "GBP",
				language: "en",
			});

			expect(feed.country).toBe("GB");
			expect(feed.currency).toBe("GBP");
			expect(feed.language).toBe("en");
		});

		it("stores the feed in the data service", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			const stored = await mockData.get("feed", feed.id);
			expect(stored).not.toBeNull();
		});
	});

	describe("getFeed", () => {
		it("returns an existing feed", async () => {
			const created = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			const feed = await controller.getFeed(created.id);
			expect(feed).not.toBeNull();
			expect(feed?.name).toBe("Test");
		});

		it("returns null for non-existent feed", async () => {
			const feed = await controller.getFeed("missing");
			expect(feed).toBeNull();
		});
	});

	describe("getFeedBySlug", () => {
		it("returns a feed by slug", async () => {
			await controller.createFeed({
				name: "Google US",
				slug: "google-us",
				channel: "google-shopping",
			});

			const feed = await controller.getFeedBySlug("google-us");
			expect(feed).not.toBeNull();
			expect(feed?.name).toBe("Google US");
		});

		it("returns null for non-existent slug", async () => {
			const feed = await controller.getFeedBySlug("missing");
			expect(feed).toBeNull();
		});
	});

	describe("updateFeed", () => {
		it("updates feed name", async () => {
			const created = await controller.createFeed({
				name: "Old Name",
				slug: "test",
				channel: "google-shopping",
			});

			const updated = await controller.updateFeed(created.id, {
				name: "New Name",
			});

			expect(updated?.name).toBe("New Name");
			expect(updated?.slug).toBe("test");
		});

		it("updates feed status", async () => {
			const created = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			const updated = await controller.updateFeed(created.id, {
				status: "active",
			});

			expect(updated?.status).toBe("active");
		});

		it("updates feed field mappings", async () => {
			const created = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "custom",
			});

			const newMappings = [{ sourceField: "title", targetField: "name" }];

			const updated = await controller.updateFeed(created.id, {
				fieldMappings: newMappings,
			});

			expect(updated?.fieldMappings).toEqual(newMappings);
		});

		it("returns null when feed not found", async () => {
			const result = await controller.updateFeed("missing", {
				name: "Test",
			});
			expect(result).toBeNull();
		});
	});

	describe("deleteFeed", () => {
		it("deletes an existing feed", async () => {
			const created = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			const deleted = await controller.deleteFeed(created.id);
			expect(deleted).toBe(true);

			const found = await controller.getFeed(created.id);
			expect(found).toBeNull();
		});

		it("deletes associated feed items and mappings", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			await controller.addCategoryMapping(feed.id, {
				storeCategory: "Electronics",
				channelCategory: "Electronics > Gadgets",
			});

			await controller.generateFeed(feed.id, [makeProduct()]);

			const deleted = await controller.deleteFeed(feed.id);
			expect(deleted).toBe(true);

			const items = await controller.getFeedItems(feed.id);
			expect(items).toHaveLength(0);

			const mappings = await controller.listCategoryMappings(feed.id);
			expect(mappings).toHaveLength(0);
		});

		it("returns false when feed not found", async () => {
			const deleted = await controller.deleteFeed("missing");
			expect(deleted).toBe(false);
		});
	});

	describe("listFeeds", () => {
		it("returns all feeds", async () => {
			await controller.createFeed({
				name: "Feed 1",
				slug: "feed-1",
				channel: "google-shopping",
			});
			await controller.createFeed({
				name: "Feed 2",
				slug: "feed-2",
				channel: "facebook",
			});

			const feeds = await controller.listFeeds();
			expect(feeds).toHaveLength(2);
		});

		it("filters by status", async () => {
			const feed = await controller.createFeed({
				name: "Active",
				slug: "active",
				channel: "google-shopping",
			});
			await controller.updateFeed(feed.id, { status: "active" });

			await controller.createFeed({
				name: "Draft",
				slug: "draft",
				channel: "google-shopping",
			});

			const active = await controller.listFeeds({ status: "active" });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Active");
		});

		it("filters by channel", async () => {
			await controller.createFeed({
				name: "Google",
				slug: "google",
				channel: "google-shopping",
			});
			await controller.createFeed({
				name: "Facebook",
				slug: "facebook",
				channel: "facebook",
			});

			const google = await controller.listFeeds({
				channel: "google-shopping",
			});
			expect(google).toHaveLength(1);
			expect(google[0].name).toBe("Google");
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createFeed({
					name: `Feed ${i}`,
					slug: `feed-${i}`,
					channel: "google-shopping",
				});
			}

			const page = await controller.listFeeds({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	describe("countFeeds", () => {
		it("returns total feed count", async () => {
			await controller.createFeed({
				name: "A",
				slug: "a",
				channel: "google-shopping",
			});
			await controller.createFeed({
				name: "B",
				slug: "b",
				channel: "facebook",
			});

			const count = await controller.countFeeds();
			expect(count).toBe(2);
		});
	});

	// ── Feed generation ────────────────────────────────────────────

	describe("generateFeed", () => {
		it("generates XML output for google-shopping", async () => {
			const feed = await controller.createFeed({
				name: "Google",
				slug: "google",
				channel: "google-shopping",
			});

			const result = await controller.generateFeed(feed.id, [makeProduct()]);

			expect(result).not.toBeNull();
			expect(result?.itemCount).toBe(1);
			expect(result?.errorCount).toBe(0);
			expect(result?.output).toContain('<?xml version="1.0"');
			expect(result?.output).toContain("<g:title>Test Product</g:title>");
			expect(result?.output).toContain("<g:price>29.99</g:price>");
		});

		it("generates CSV output", async () => {
			const feed = await controller.createFeed({
				name: "CSV",
				slug: "csv",
				channel: "google-shopping",
				format: "csv",
			});

			const result = await controller.generateFeed(feed.id, [makeProduct()]);

			expect(result).not.toBeNull();
			expect(result?.output).toContain("g:id");
			expect(result?.output).toContain("g:title");
			expect(result?.output).toContain("Test Product");
		});

		it("generates TSV output", async () => {
			const feed = await controller.createFeed({
				name: "TSV",
				slug: "tsv",
				channel: "google-shopping",
				format: "tsv",
			});

			const result = await controller.generateFeed(feed.id, [makeProduct()]);

			expect(result).not.toBeNull();
			expect(result?.output).toContain("\t");
		});

		it("generates JSON output", async () => {
			const feed = await controller.createFeed({
				name: "JSON",
				slug: "json",
				channel: "facebook",
				format: "json",
			});

			const result = await controller.generateFeed(feed.id, [makeProduct()]);

			expect(result).not.toBeNull();
			const parsed = JSON.parse(result?.output ?? "");
			expect(parsed.products).toHaveLength(1);
			expect(parsed.products[0].title).toBe("Test Product");
		});

		it("applies product filters - excludes products below minPrice", async () => {
			const feed = await controller.createFeed({
				name: "Filtered",
				slug: "filtered",
				channel: "google-shopping",
				filters: { minPrice: 50 },
			});

			const result = await controller.generateFeed(feed.id, [
				makeProduct({ price: 29.99 }),
				makeProduct({ price: 99.99 }),
			]);

			expect(result?.itemCount).toBe(1);
		});

		it("applies product filters - excludes products above maxPrice", async () => {
			const feed = await controller.createFeed({
				name: "Max Price",
				slug: "max-price",
				channel: "google-shopping",
				filters: { maxPrice: 50 },
			});

			const result = await controller.generateFeed(feed.id, [
				makeProduct({ price: 29.99 }),
				makeProduct({ price: 99.99 }),
			]);

			expect(result?.itemCount).toBe(1);
		});

		it("applies product filters - requires images", async () => {
			const feed = await controller.createFeed({
				name: "Images Required",
				slug: "images-required",
				channel: "google-shopping",
				filters: { requireImages: true },
			});

			const result = await controller.generateFeed(feed.id, [
				makeProduct({ imageUrl: "https://example.com/img.jpg" }),
				makeProduct({ imageUrl: undefined }),
			]);

			expect(result?.itemCount).toBe(1);
		});

		it("applies product filters - requires in stock", async () => {
			const feed = await controller.createFeed({
				name: "In Stock Only",
				slug: "in-stock",
				channel: "google-shopping",
				filters: { requireInStock: true },
			});

			const result = await controller.generateFeed(feed.id, [
				makeProduct({ availability: "in_stock" }),
				makeProduct({ availability: "out_of_stock" }),
			]);

			expect(result?.itemCount).toBe(1);
		});

		it("applies product filters - excludes categories", async () => {
			const feed = await controller.createFeed({
				name: "No Electronics",
				slug: "no-electronics",
				channel: "google-shopping",
				filters: { excludeCategories: ["Electronics"] },
			});

			const result = await controller.generateFeed(feed.id, [
				makeProduct({ category: "Electronics" }),
				makeProduct({ category: "Clothing" }),
			]);

			expect(result?.itemCount).toBe(1);
		});

		it("applies product filters - includes only specified categories", async () => {
			const feed = await controller.createFeed({
				name: "Clothing Only",
				slug: "clothing-only",
				channel: "google-shopping",
				filters: { includeCategories: ["Clothing"] },
			});

			const result = await controller.generateFeed(feed.id, [
				makeProduct({ category: "Electronics" }),
				makeProduct({ category: "Clothing" }),
			]);

			expect(result?.itemCount).toBe(1);
		});

		it("creates feed items for each product", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			const products = [makeProduct(), makeProduct()];
			await controller.generateFeed(feed.id, products);

			const items = await controller.getFeedItems(feed.id);
			expect(items).toHaveLength(2);
		});

		it("marks excluded products with excluded status", async () => {
			const feed = await controller.createFeed({
				name: "Filtered",
				slug: "filtered",
				channel: "google-shopping",
				filters: { minPrice: 100 },
			});

			const product = makeProduct({ id: "cheap", price: 5 });
			await controller.generateFeed(feed.id, [product]);

			const item = await controller.getFeedItem(feed.id, "cheap");
			expect(item?.status).toBe("excluded");
		});

		it("reports validation errors for missing required fields", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			const product = makeProduct({
				id: "no-url",
				url: undefined,
				imageUrl: undefined,
			});
			const result = await controller.generateFeed(feed.id, [product]);

			expect(result?.errorCount).toBe(1);
		});

		it("applies category mappings during generation", async () => {
			const feed = await controller.createFeed({
				name: "Mapped",
				slug: "mapped",
				channel: "google-shopping",
			});

			await controller.addCategoryMapping(feed.id, {
				storeCategory: "Electronics",
				channelCategory: "Electronics > Computers & Accessories",
			});

			const product = makeProduct({ category: "Electronics" });
			const result = await controller.generateFeed(feed.id, [product]);

			expect(result?.output).toContain(
				"Electronics &gt; Computers &amp; Accessories",
			);
		});

		it("applies field transforms - uppercase", async () => {
			const feed = await controller.createFeed({
				name: "Transform",
				slug: "transform",
				channel: "custom",
				fieldMappings: [
					{
						sourceField: "title",
						targetField: "name",
						transform: "uppercase",
					},
				],
				format: "json",
			});

			const result = await controller.generateFeed(feed.id, [
				makeProduct({ title: "hello world" }),
			]);

			const parsed = JSON.parse(result?.output ?? "");
			expect(parsed.products[0].name).toBe("HELLO WORLD");
		});

		it("applies field transforms - lowercase", async () => {
			const feed = await controller.createFeed({
				name: "Lower",
				slug: "lower",
				channel: "custom",
				fieldMappings: [
					{
						sourceField: "title",
						targetField: "name",
						transform: "lowercase",
					},
				],
				format: "json",
			});

			const result = await controller.generateFeed(feed.id, [
				makeProduct({ title: "HELLO WORLD" }),
			]);

			const parsed = JSON.parse(result?.output ?? "");
			expect(parsed.products[0].name).toBe("hello world");
		});

		it("applies field transforms - prefix", async () => {
			const feed = await controller.createFeed({
				name: "Prefix",
				slug: "prefix",
				channel: "custom",
				fieldMappings: [
					{
						sourceField: "sku",
						targetField: "item_id",
						transform: "prefix",
						transformValue: "STORE-",
					},
				],
				format: "json",
			});

			const result = await controller.generateFeed(feed.id, [
				makeProduct({ sku: "ABC123" }),
			]);

			const parsed = JSON.parse(result?.output ?? "");
			expect(parsed.products[0].item_id).toBe("STORE-ABC123");
		});

		it("applies field transforms - suffix", async () => {
			const feed = await controller.createFeed({
				name: "Suffix",
				slug: "suffix",
				channel: "custom",
				fieldMappings: [
					{
						sourceField: "title",
						targetField: "name",
						transform: "suffix",
						transformValue: " - Sale",
					},
				],
				format: "json",
			});

			const result = await controller.generateFeed(feed.id, [
				makeProduct({ title: "Widget" }),
			]);

			const parsed = JSON.parse(result?.output ?? "");
			expect(parsed.products[0].name).toBe("Widget - Sale");
		});

		it("applies field transforms - template", async () => {
			const feed = await controller.createFeed({
				name: "Template",
				slug: "template",
				channel: "custom",
				fieldMappings: [
					{
						sourceField: "title",
						targetField: "name",
						transform: "template",
						transformValue: "Buy {value} now!",
					},
				],
				format: "json",
			});

			const result = await controller.generateFeed(feed.id, [
				makeProduct({ title: "Widget" }),
			]);

			const parsed = JSON.parse(result?.output ?? "");
			expect(parsed.products[0].name).toBe("Buy Widget now!");
		});

		it("uses default values when source field is empty", async () => {
			const feed = await controller.createFeed({
				name: "Defaults",
				slug: "defaults",
				channel: "custom",
				fieldMappings: [
					{
						sourceField: "brand",
						targetField: "brand",
						defaultValue: "Unknown Brand",
					},
				],
				format: "json",
			});

			const result = await controller.generateFeed(feed.id, [
				makeProduct({ brand: undefined }),
			]);

			const parsed = JSON.parse(result?.output ?? "");
			expect(parsed.products[0].brand).toBe("Unknown Brand");
		});

		it("clears previous feed items on re-generation", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			await controller.generateFeed(feed.id, [
				makeProduct(),
				makeProduct(),
				makeProduct(),
			]);

			let items = await controller.getFeedItems(feed.id);
			expect(items).toHaveLength(3);

			await controller.generateFeed(feed.id, [makeProduct()]);

			items = await controller.getFeedItems(feed.id);
			expect(items).toHaveLength(1);
		});

		it("updates feed status and stats after generation", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			await controller.generateFeed(feed.id, [makeProduct(), makeProduct()]);

			const updated = await controller.getFeed(feed.id);
			expect(updated?.itemCount).toBe(2);
			expect(updated?.lastGeneratedAt).toBeDefined();
			expect(updated?.status).toBe("active");
		});

		it("returns null for non-existent feed", async () => {
			const result = await controller.generateFeed("missing", [makeProduct()]);
			expect(result).toBeNull();
		});

		it("handles custom fields in products", async () => {
			const feed = await controller.createFeed({
				name: "Custom Fields",
				slug: "custom-fields",
				channel: "custom",
				fieldMappings: [{ sourceField: "custom_label", targetField: "label" }],
				format: "json",
			});

			const result = await controller.generateFeed(feed.id, [
				makeProduct({
					customFields: { custom_label: "BESTSELLER" },
				}),
			]);

			const parsed = JSON.parse(result?.output ?? "");
			expect(parsed.products[0].label).toBe("BESTSELLER");
		});

		it("escapes XML special characters", async () => {
			const feed = await controller.createFeed({
				name: "XML Escape",
				slug: "xml-escape",
				channel: "google-shopping",
			});

			const result = await controller.generateFeed(feed.id, [
				makeProduct({ title: 'Widget <"Special"> & More' }),
			]);

			expect(result?.output).toContain(
				"Widget &lt;&quot;Special&quot;&gt; &amp; More",
			);
		});

		it("escapes CSV fields with commas", async () => {
			const feed = await controller.createFeed({
				name: "CSV Escape",
				slug: "csv-escape",
				channel: "google-shopping",
				format: "csv",
			});

			const result = await controller.generateFeed(feed.id, [
				makeProduct({ title: "Widget, Deluxe Edition" }),
			]);

			expect(result?.output).toContain('"Widget, Deluxe Edition"');
		});

		it("generates empty output for no matching products", async () => {
			const feed = await controller.createFeed({
				name: "Empty",
				slug: "empty",
				channel: "google-shopping",
				filters: { minPrice: 9999 },
			});

			const result = await controller.generateFeed(feed.id, [
				makeProduct({ price: 10 }),
			]);

			expect(result?.itemCount).toBe(0);
		});
	});

	describe("getFeedOutput", () => {
		it("returns cached output after generation", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			await controller.generateFeed(feed.id, [makeProduct()]);

			const output = await controller.getFeedOutput(feed.id);
			expect(output).not.toBeNull();
			expect(output).toContain('<?xml version="1.0"');
		});

		it("returns null for feed without generation", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			const output = await controller.getFeedOutput(feed.id);
			expect(output).toBeNull();
		});

		it("returns null for non-existent feed", async () => {
			const output = await controller.getFeedOutput("missing");
			expect(output).toBeNull();
		});
	});

	// ── Feed items ─────────────────────────────────────────────────

	describe("getFeedItems", () => {
		it("returns items for a feed", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			await controller.generateFeed(feed.id, [makeProduct(), makeProduct()]);

			const items = await controller.getFeedItems(feed.id);
			expect(items).toHaveLength(2);
		});

		it("filters by status", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
				filters: { minPrice: 50 },
			});

			await controller.generateFeed(feed.id, [
				makeProduct({ price: 10 }),
				makeProduct({ price: 100 }),
			]);

			const excluded = await controller.getFeedItems(feed.id, {
				status: "excluded",
			});
			expect(excluded).toHaveLength(1);
		});

		it("supports pagination", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			const products = Array.from({ length: 5 }, () => makeProduct());
			await controller.generateFeed(feed.id, products);

			const page = await controller.getFeedItems(feed.id, {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});
	});

	describe("getFeedItem", () => {
		it("returns a specific feed item by productId", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			const product = makeProduct({ id: "product-123" });
			await controller.generateFeed(feed.id, [product]);

			const item = await controller.getFeedItem(feed.id, "product-123");
			expect(item).not.toBeNull();
			expect(item?.productId).toBe("product-123");
		});

		it("returns null for non-existent product", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			const item = await controller.getFeedItem(feed.id, "missing");
			expect(item).toBeNull();
		});
	});

	describe("countFeedItems", () => {
		it("returns the count of feed items", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			await controller.generateFeed(feed.id, [
				makeProduct(),
				makeProduct(),
				makeProduct(),
			]);

			const count = await controller.countFeedItems(feed.id);
			expect(count).toBe(3);
		});
	});

	// ── Category mappings ──────────────────────────────────────────

	describe("addCategoryMapping", () => {
		it("creates a category mapping", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			const mapping = await controller.addCategoryMapping(feed.id, {
				storeCategory: "Electronics",
				channelCategory: "Electronics > Computers & Accessories",
				channelCategoryId: "1234",
			});

			expect(mapping.id).toBeDefined();
			expect(mapping.feedId).toBe(feed.id);
			expect(mapping.storeCategory).toBe("Electronics");
			expect(mapping.channelCategory).toBe(
				"Electronics > Computers & Accessories",
			);
			expect(mapping.channelCategoryId).toBe("1234");
		});
	});

	describe("updateCategoryMapping", () => {
		it("updates the channel category", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			const mapping = await controller.addCategoryMapping(feed.id, {
				storeCategory: "Electronics",
				channelCategory: "Old Category",
			});

			const updated = await controller.updateCategoryMapping(mapping.id, {
				channelCategory: "New Category",
			});

			expect(updated?.channelCategory).toBe("New Category");
		});

		it("returns null for non-existent mapping", async () => {
			const result = await controller.updateCategoryMapping("missing", {
				channelCategory: "Test",
			});
			expect(result).toBeNull();
		});
	});

	describe("deleteCategoryMapping", () => {
		it("deletes an existing mapping", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			const mapping = await controller.addCategoryMapping(feed.id, {
				storeCategory: "Electronics",
				channelCategory: "Test",
			});

			const deleted = await controller.deleteCategoryMapping(mapping.id);
			expect(deleted).toBe(true);

			const mappings = await controller.listCategoryMappings(feed.id);
			expect(mappings).toHaveLength(0);
		});

		it("returns false for non-existent mapping", async () => {
			const deleted = await controller.deleteCategoryMapping("missing");
			expect(deleted).toBe(false);
		});
	});

	describe("listCategoryMappings", () => {
		it("returns all mappings for a feed", async () => {
			const feed = await controller.createFeed({
				name: "Test",
				slug: "test",
				channel: "google-shopping",
			});

			await controller.addCategoryMapping(feed.id, {
				storeCategory: "Electronics",
				channelCategory: "Electronics > Gadgets",
			});
			await controller.addCategoryMapping(feed.id, {
				storeCategory: "Clothing",
				channelCategory: "Apparel & Accessories",
			});

			const mappings = await controller.listCategoryMappings(feed.id);
			expect(mappings).toHaveLength(2);
		});

		it("does not return mappings from other feeds", async () => {
			const feed1 = await controller.createFeed({
				name: "Feed 1",
				slug: "feed-1",
				channel: "google-shopping",
			});
			const feed2 = await controller.createFeed({
				name: "Feed 2",
				slug: "feed-2",
				channel: "facebook",
			});

			await controller.addCategoryMapping(feed1.id, {
				storeCategory: "A",
				channelCategory: "X",
			});
			await controller.addCategoryMapping(feed2.id, {
				storeCategory: "B",
				channelCategory: "Y",
			});

			const mappings = await controller.listCategoryMappings(feed1.id);
			expect(mappings).toHaveLength(1);
			expect(mappings[0].storeCategory).toBe("A");
		});
	});

	// ── Validation ─────────────────────────────────────────────────

	describe("validateFeed", () => {
		it("reports missing field mappings on custom feed", async () => {
			const feed = await controller.createFeed({
				name: "Empty Custom",
				slug: "empty-custom",
				channel: "custom",
			});

			const issues = await controller.validateFeed(feed.id);
			expect(issues.some((i) => i.field === "fieldMappings")).toBe(true);
		});

		it("reports missing required field mappings for Google Shopping", async () => {
			const feed = await controller.createFeed({
				name: "Partial",
				slug: "partial",
				channel: "google-shopping",
				fieldMappings: [{ sourceField: "title", targetField: "g:title" }],
			});

			const issues = await controller.validateFeed(feed.id);
			const warnings = issues.filter((i) => i.severity === "warning");
			expect(warnings.length).toBeGreaterThan(0);
			expect(warnings.some((w) => w.field === "g:id")).toBe(true);
		});

		it("includes item-level issues after generation", async () => {
			const feed = await controller.createFeed({
				name: "Errors",
				slug: "errors",
				channel: "google-shopping",
			});

			await controller.generateFeed(feed.id, [
				makeProduct({ url: undefined, imageUrl: undefined }),
			]);

			const issues = await controller.validateFeed(feed.id);
			const errors = issues.filter((i) => i.severity === "error");
			expect(errors.length).toBeGreaterThan(0);
		});

		it("returns empty array for non-existent feed", async () => {
			const issues = await controller.validateFeed("missing");
			expect(issues).toEqual([]);
		});
	});

	// ── Stats ──────────────────────────────────────────────────────

	describe("getStats", () => {
		it("returns aggregate statistics", async () => {
			const feed1 = await controller.createFeed({
				name: "Active",
				slug: "active",
				channel: "google-shopping",
			});
			await controller.updateFeed(feed1.id, { status: "active" });

			await controller.createFeed({
				name: "Draft",
				slug: "draft",
				channel: "facebook",
			});

			await controller.generateFeed(feed1.id, [makeProduct(), makeProduct()]);

			const stats = await controller.getStats();
			expect(stats.totalFeeds).toBe(2);
			expect(stats.activeFeeds).toBe(1);
			expect(stats.totalItems).toBe(2);
		});

		it("returns zeros when no feeds exist", async () => {
			const stats = await controller.getStats();
			expect(stats.totalFeeds).toBe(0);
			expect(stats.activeFeeds).toBe(0);
			expect(stats.totalItems).toBe(0);
			expect(stats.errorItems).toBe(0);
			expect(stats.warningItems).toBe(0);
		});
	});

	// ── Multi-channel support ──────────────────────────────────────

	describe("multi-channel", () => {
		it("generates correct output for Microsoft channel", async () => {
			const feed = await controller.createFeed({
				name: "Microsoft",
				slug: "microsoft",
				channel: "microsoft",
			});

			const result = await controller.generateFeed(feed.id, [makeProduct()]);

			expect(result?.output).toContain("<g:title>");
		});

		it("generates correct output for Pinterest channel", async () => {
			const feed = await controller.createFeed({
				name: "Pinterest",
				slug: "pinterest",
				channel: "pinterest",
				format: "json",
			});

			const result = await controller.generateFeed(feed.id, [makeProduct()]);

			const parsed = JSON.parse(result?.output ?? "");
			expect(parsed.products[0].title).toBe("Test Product");
		});

		it("generates correct output for TikTok channel", async () => {
			const feed = await controller.createFeed({
				name: "TikTok",
				slug: "tiktok",
				channel: "tiktok",
				format: "csv",
			});

			const result = await controller.generateFeed(feed.id, [makeProduct()]);

			expect(result?.output).toContain("title");
			expect(result?.output).toContain("Test Product");
		});
	});

	// ── Title/description warnings ─────────────────────────────────

	describe("validation warnings", () => {
		it("warns when title exceeds 150 characters", async () => {
			const feed = await controller.createFeed({
				name: "Long Title",
				slug: "long-title",
				channel: "google-shopping",
			});

			const longTitle = "A".repeat(160);
			const result = await controller.generateFeed(feed.id, [
				makeProduct({ title: longTitle }),
			]);

			expect(result?.warningCount).toBe(1);
		});

		it("warns when description exceeds 5000 characters", async () => {
			const feed = await controller.createFeed({
				name: "Long Desc",
				slug: "long-desc",
				channel: "google-shopping",
			});

			const longDesc = "B".repeat(5001);
			const result = await controller.generateFeed(feed.id, [
				makeProduct({ description: longDesc }),
			]);

			expect(result?.warningCount).toBe(1);
		});
	});
});
