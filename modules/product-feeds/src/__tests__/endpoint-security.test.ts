import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { ProductData } from "../service";
import { createProductFeedsController } from "../service-impl";

/**
 * Security regression tests for product-feeds endpoints.
 *
 * Covers: cascade deletion, feed defaults, channel-specific mappings,
 * feed generation with filters/validation, nonexistent resource guards,
 * category mapping CRUD, feed output formatting, stats accuracy,
 * and data isolation between feeds.
 */

describe("product-feeds endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createProductFeedsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createProductFeedsController(mockData);
	});

	const sampleProduct: ProductData = {
		id: "prod_1",
		title: "Test Widget",
		description: "A fine widget",
		price: 2999,
		sku: "WIDGET-001",
		brand: "Acme",
		category: "Electronics",
		imageUrl: "https://example.com/widget.jpg",
		url: "https://store.com/widget",
		availability: "in_stock",
		condition: "new",
	};

	// ── Cascade Deletion ────────────────────────────────────────────────

	describe("cascade deletion", () => {
		it("deleting a feed removes all its category mappings", async () => {
			const feed = await controller.createFeed({
				name: "Google Feed",
				slug: "google-feed",
				channel: "google-shopping",
				format: "xml",
			});

			await controller.addCategoryMapping(feed.id, {
				storeCategory: "Electronics",
				channelCategory: "Electronics > Gadgets",
			});
			await controller.addCategoryMapping(feed.id, {
				storeCategory: "Clothing",
				channelCategory: "Apparel",
			});

			await controller.deleteFeed(feed.id);

			const mappings = await controller.listCategoryMappings(feed.id);
			expect(mappings).toHaveLength(0);
		});

		it("deleting a feed does not affect other feeds' mappings", async () => {
			const feed1 = await controller.createFeed({
				name: "Feed 1",
				slug: "feed-1",
				channel: "google-shopping",
				format: "xml",
			});
			const feed2 = await controller.createFeed({
				name: "Feed 2",
				slug: "feed-2",
				channel: "facebook",
				format: "xml",
			});

			await controller.addCategoryMapping(feed1.id, {
				storeCategory: "Electronics",
				channelCategory: "Tech",
			});
			await controller.addCategoryMapping(feed2.id, {
				storeCategory: "Clothing",
				channelCategory: "Apparel",
			});

			await controller.deleteFeed(feed1.id);

			const feed2Mappings = await controller.listCategoryMappings(feed2.id);
			expect(feed2Mappings).toHaveLength(1);
		});

		it("deleting a feed removes all its feed items", async () => {
			const feed = await controller.createFeed({
				name: "Feed",
				slug: "feed",
				channel: "google-shopping",
				format: "xml",
			});

			await controller.generateFeed(feed.id, [sampleProduct]);

			await controller.deleteFeed(feed.id);

			const count = await controller.countFeedItems(feed.id);
			expect(count).toBe(0);
		});
	});

	// ── Feed Creation Defaults ──────────────────────────────────────────

	describe("feed creation defaults", () => {
		it("new feeds start as draft", async () => {
			const feed = await controller.createFeed({
				name: "Draft Feed",
				slug: "draft-feed",
				channel: "google-shopping",
				format: "xml",
			});
			expect(feed.status).toBe("draft");
		});

		it("new feeds have zero counters", async () => {
			const feed = await controller.createFeed({
				name: "New Feed",
				slug: "new-feed",
				channel: "google-shopping",
				format: "xml",
			});
			expect(feed.itemCount).toBe(0);
			expect(feed.errorCount).toBe(0);
			expect(feed.warningCount).toBe(0);
		});

		it("google-shopping gets default field mappings", async () => {
			const feed = await controller.createFeed({
				name: "Google Feed",
				slug: "google-feed",
				channel: "google-shopping",
				format: "xml",
			});
			expect(feed.fieldMappings).toBeDefined();
			expect(feed.fieldMappings.length).toBeGreaterThan(0);
			expect(feed.fieldMappings.some((m) => m.targetField === "g:title")).toBe(
				true,
			);
		});

		it("facebook gets default field mappings", async () => {
			const feed = await controller.createFeed({
				name: "FB Feed",
				slug: "fb-feed",
				channel: "facebook",
				format: "xml",
			});
			expect(feed.fieldMappings.some((m) => m.targetField === "title")).toBe(
				true,
			);
		});

		it("custom channel gets empty default mappings", async () => {
			const feed = await controller.createFeed({
				name: "Custom Feed",
				slug: "custom-feed",
				channel: "custom",
				format: "json",
			});
			expect(feed.fieldMappings).toHaveLength(0);
		});

		it("custom mappings override channel defaults", async () => {
			const feed = await controller.createFeed({
				name: "Custom Mapped",
				slug: "custom-mapped",
				channel: "google-shopping",
				format: "xml",
				fieldMappings: [{ sourceField: "title", targetField: "my_title" }],
			});
			expect(feed.fieldMappings).toHaveLength(1);
			expect(feed.fieldMappings[0]?.targetField).toBe("my_title");
		});
	});

	// ── Nonexistent Resource Guards ─────────────────────────────────────

	describe("nonexistent resource handling", () => {
		it("getFeed returns null for fabricated ID", async () => {
			expect(await controller.getFeed("nonexistent")).toBeNull();
		});

		it("getFeedBySlug returns null for fabricated slug", async () => {
			expect(await controller.getFeedBySlug("nonexistent")).toBeNull();
		});

		it("updateFeed returns null for fabricated ID", async () => {
			expect(
				await controller.updateFeed("nonexistent", { name: "X" }),
			).toBeNull();
		});

		it("deleteFeed returns false for fabricated ID", async () => {
			expect(await controller.deleteFeed("nonexistent")).toBe(false);
		});

		it("generateFeed returns null for fabricated ID", async () => {
			expect(
				await controller.generateFeed("nonexistent", [sampleProduct]),
			).toBeNull();
		});

		it("getFeedOutput returns null for fabricated ID", async () => {
			expect(await controller.getFeedOutput("nonexistent")).toBeNull();
		});

		it("updateCategoryMapping returns null for fabricated ID", async () => {
			expect(
				await controller.updateCategoryMapping("nonexistent", {
					channelCategory: "X",
				}),
			).toBeNull();
		});

		it("deleteCategoryMapping returns false for fabricated ID", async () => {
			expect(await controller.deleteCategoryMapping("nonexistent")).toBe(false);
		});
	});

	// ── Feed Generation ─────────────────────────────────────────────────

	describe("feed generation", () => {
		it("generates feed items from product data", async () => {
			const feed = await controller.createFeed({
				name: "Feed",
				slug: "gen-feed",
				channel: "google-shopping",
				format: "xml",
			});

			const result = await controller.generateFeed(feed.id, [sampleProduct]);
			expect(result).not.toBeNull();
			expect(result?.itemCount).toBe(1);
			expect(result?.errorCount).toBe(0);
		});

		it("draft feed transitions to active after generation", async () => {
			const feed = await controller.createFeed({
				name: "Draft",
				slug: "draft-gen",
				channel: "google-shopping",
				format: "xml",
			});

			await controller.generateFeed(feed.id, [sampleProduct]);

			const updated = await controller.getFeed(feed.id);
			expect(updated?.status).toBe("active");
		});

		it("feed with errors transitions to error status", async () => {
			const feed = await controller.createFeed({
				name: "Error Feed",
				slug: "error-feed",
				channel: "google-shopping",
				format: "xml",
			});

			// Product with no URL, image, or availability → required fields missing
			const badProduct: ProductData = {
				id: "bad_1",
				title: "Bad Product",
				price: 100,
			};

			await controller.generateFeed(feed.id, [badProduct]);

			const updated = await controller.getFeed(feed.id);
			expect(updated?.status).toBe("error");
			expect(updated?.errorCount).toBeGreaterThan(0);
		});

		it("filtered products marked as excluded", async () => {
			const feed = await controller.createFeed({
				name: "Filtered",
				slug: "filtered",
				channel: "google-shopping",
				format: "xml",
				filters: { minPrice: 5000 },
			});

			await controller.generateFeed(feed.id, [sampleProduct]); // price 2999 < 5000

			const items = await controller.getFeedItems(feed.id, {
				status: "excluded",
			});
			expect(items).toHaveLength(1);
		});

		it("requireInStock filter excludes out-of-stock products", async () => {
			const feed = await controller.createFeed({
				name: "In Stock Only",
				slug: "in-stock",
				channel: "google-shopping",
				format: "xml",
				filters: { requireInStock: true },
			});

			const oosProduct: ProductData = {
				...sampleProduct,
				id: "oos_1",
				availability: "out_of_stock",
			};

			const result = await controller.generateFeed(feed.id, [oosProduct]);
			expect(result?.itemCount).toBe(0);
		});

		it("cachedOutput stored and retrievable", async () => {
			const feed = await controller.createFeed({
				name: "Cached",
				slug: "cached",
				channel: "google-shopping",
				format: "xml",
			});

			await controller.generateFeed(feed.id, [sampleProduct]);

			const output = await controller.getFeedOutput(feed.id);
			expect(output).not.toBeNull();
			expect(output).toContain("Test Widget");
		});

		it("regeneration clears previous items", async () => {
			const feed = await controller.createFeed({
				name: "Regen",
				slug: "regen",
				channel: "google-shopping",
				format: "xml",
			});

			await controller.generateFeed(feed.id, [
				sampleProduct,
				{ ...sampleProduct, id: "prod_2", title: "Widget 2" },
			]);
			expect(await controller.countFeedItems(feed.id)).toBe(2);

			await controller.generateFeed(feed.id, [sampleProduct]);
			expect(await controller.countFeedItems(feed.id)).toBe(1);
		});
	});

	// ── Output Formats ──────────────────────────────────────────────────

	describe("output formats", () => {
		it("generates valid XML output", async () => {
			const feed = await controller.createFeed({
				name: "XML",
				slug: "xml-feed",
				channel: "google-shopping",
				format: "xml",
			});
			await controller.generateFeed(feed.id, [sampleProduct]);
			const output = await controller.getFeedOutput(feed.id);
			expect(output).toContain("<?xml");
			expect(output).toContain("<rss");
			expect(output).toContain("<item>");
		});

		it("generates valid JSON output", async () => {
			const feed = await controller.createFeed({
				name: "JSON",
				slug: "json-feed",
				channel: "custom",
				format: "json",
				fieldMappings: [
					{ sourceField: "id", targetField: "id" },
					{ sourceField: "title", targetField: "title" },
				],
			});
			await controller.generateFeed(feed.id, [sampleProduct]);
			const output = await controller.getFeedOutput(feed.id);
			expect(output).not.toBeNull();
			const parsed = JSON.parse(output as string);
			expect(parsed.products).toHaveLength(1);
		});

		it("generates CSV output", async () => {
			const feed = await controller.createFeed({
				name: "CSV",
				slug: "csv-feed",
				channel: "custom",
				format: "csv",
				fieldMappings: [
					{ sourceField: "id", targetField: "id" },
					{ sourceField: "title", targetField: "title" },
				],
			});
			await controller.generateFeed(feed.id, [sampleProduct]);
			const output = await controller.getFeedOutput(feed.id);
			expect(output).toContain("id");
			expect(output).toContain("title");
		});
	});

	// ── Category Mapping CRUD ───────────────────────────────────────────

	describe("category mapping CRUD", () => {
		it("addCategoryMapping creates a mapping", async () => {
			const feed = await controller.createFeed({
				name: "Feed",
				slug: "cm-feed",
				channel: "google-shopping",
				format: "xml",
			});

			const mapping = await controller.addCategoryMapping(feed.id, {
				storeCategory: "Shoes",
				channelCategory: "Footwear",
			});

			expect(mapping.storeCategory).toBe("Shoes");
			expect(mapping.channelCategory).toBe("Footwear");
			expect(mapping.feedId).toBe(feed.id);
		});

		it("updateCategoryMapping modifies the mapping", async () => {
			const feed = await controller.createFeed({
				name: "Feed",
				slug: "cm-update",
				channel: "google-shopping",
				format: "xml",
			});

			const mapping = await controller.addCategoryMapping(feed.id, {
				storeCategory: "Shoes",
				channelCategory: "Footwear",
			});

			const updated = await controller.updateCategoryMapping(mapping.id, {
				channelCategory: "Shoes & Boots",
			});
			expect(updated?.channelCategory).toBe("Shoes & Boots");
		});

		it("deleteCategoryMapping removes only that mapping", async () => {
			const feed = await controller.createFeed({
				name: "Feed",
				slug: "cm-delete",
				channel: "google-shopping",
				format: "xml",
			});

			const m1 = await controller.addCategoryMapping(feed.id, {
				storeCategory: "A",
				channelCategory: "B",
			});
			await controller.addCategoryMapping(feed.id, {
				storeCategory: "C",
				channelCategory: "D",
			});

			await controller.deleteCategoryMapping(m1.id);

			const remaining = await controller.listCategoryMappings(feed.id);
			expect(remaining).toHaveLength(1);
			expect(remaining[0]?.storeCategory).toBe("C");
		});

		it("category mappings applied during feed generation", async () => {
			const feed = await controller.createFeed({
				name: "Mapped Feed",
				slug: "mapped",
				channel: "google-shopping",
				format: "xml",
			});

			await controller.addCategoryMapping(feed.id, {
				storeCategory: "Electronics",
				channelCategory: "Consumer Electronics > Gadgets",
			});

			const result = await controller.generateFeed(feed.id, [sampleProduct]);
			const output = result?.output ?? "";
			expect(output).toContain("Consumer Electronics");
		});
	});

	// ── Feed Update Integrity ───────────────────────────────────────────

	describe("update integrity", () => {
		it("update preserves unmodified fields", async () => {
			const feed = await controller.createFeed({
				name: "Original",
				slug: "original",
				channel: "google-shopping",
				format: "xml",
			});

			const updated = await controller.updateFeed(feed.id, {
				name: "Updated",
			});

			expect(updated?.name).toBe("Updated");
			expect(updated?.slug).toBe("original");
			expect(updated?.channel).toBe("google-shopping");
			expect(updated?.format).toBe("xml");
		});

		it("can change feed status", async () => {
			const feed = await controller.createFeed({
				name: "Feed",
				slug: "status-change",
				channel: "google-shopping",
				format: "xml",
			});

			const updated = await controller.updateFeed(feed.id, {
				status: "paused",
			});
			expect(updated?.status).toBe("paused");
		});
	});

	// ── Stats Accuracy ──────────────────────────────────────────────────

	describe("stats accuracy", () => {
		it("empty store returns zeroed stats", async () => {
			const stats = await controller.getStats();
			expect(stats.totalFeeds).toBe(0);
			expect(stats.activeFeeds).toBe(0);
			expect(stats.totalItems).toBe(0);
		});

		it("counts reflect active feeds and items", async () => {
			const feed = await controller.createFeed({
				name: "Active",
				slug: "active-stats",
				channel: "google-shopping",
				format: "xml",
			});

			await controller.generateFeed(feed.id, [sampleProduct]);

			const stats = await controller.getStats();
			expect(stats.totalFeeds).toBe(1);
			expect(stats.activeFeeds).toBe(1);
			expect(stats.totalItems).toBeGreaterThan(0);
		});
	});

	// ── Validation ──────────────────────────────────────────────────────

	describe("feed validation", () => {
		it("returns empty issues for nonexistent feed", async () => {
			const issues = await controller.validateFeed("nonexistent");
			expect(issues).toHaveLength(0);
		});

		it("flags missing required field mappings", async () => {
			const feed = await controller.createFeed({
				name: "Unmapped",
				slug: "unmapped",
				channel: "google-shopping",
				format: "xml",
				fieldMappings: [],
			});

			const issues = await controller.validateFeed(feed.id);
			expect(issues.some((i) => i.field === "fieldMappings")).toBe(true);
		});

		it("flags missing channel-required target fields", async () => {
			const feed = await controller.createFeed({
				name: "Partial",
				slug: "partial",
				channel: "google-shopping",
				format: "xml",
				fieldMappings: [{ sourceField: "title", targetField: "g:title" }],
			});

			const issues = await controller.validateFeed(feed.id);
			// Should flag missing g:link, g:price, etc.
			expect(issues.some((i) => i.field === "g:link")).toBe(true);
		});
	});

	// ── Feed Listing ────────────────────────────────────────────────────

	describe("feed listing and filtering", () => {
		it("listFeeds filters by status", async () => {
			await controller.createFeed({
				name: "Draft",
				slug: "list-draft",
				channel: "custom",
				format: "json",
			});
			const feed2 = await controller.createFeed({
				name: "Active",
				slug: "list-active",
				channel: "custom",
				format: "json",
			});
			await controller.updateFeed(feed2.id, { status: "active" });

			const active = await controller.listFeeds({ status: "active" });
			expect(active).toHaveLength(1);
			expect(active[0]?.name).toBe("Active");
		});

		it("listFeeds filters by channel", async () => {
			await controller.createFeed({
				name: "Google",
				slug: "ch-google",
				channel: "google-shopping",
				format: "xml",
			});
			await controller.createFeed({
				name: "Facebook",
				slug: "ch-fb",
				channel: "facebook",
				format: "xml",
			});

			const google = await controller.listFeeds({
				channel: "google-shopping",
			});
			expect(google).toHaveLength(1);
			expect(google[0]?.name).toBe("Google");
		});

		it("countFeeds returns accurate count", async () => {
			await controller.createFeed({
				name: "A",
				slug: "count-a",
				channel: "custom",
				format: "json",
			});
			await controller.createFeed({
				name: "B",
				slug: "count-b",
				channel: "custom",
				format: "json",
			});

			expect(await controller.countFeeds()).toBe(2);
		});
	});
});
