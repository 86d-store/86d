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

function unwrap<T>(value: T | null | undefined): T {
	expect(value).not.toBeNull();
	return value as T;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("product-feeds controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ProductFeedsController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createProductFeedsController(mockData);
	});

	// ── Feed CRUD edge cases ────────────────────────────────────────

	describe("feed CRUD edge cases", () => {
		it("creating two feeds with different channels yields correct default mappings", async () => {
			const google = await controller.createFeed({
				name: "Google",
				slug: "google",
				channel: "google-shopping",
			});
			const facebook = await controller.createFeed({
				name: "Facebook",
				slug: "facebook",
				channel: "facebook",
			});

			// Google mappings use g: prefix
			expect(
				google.fieldMappings.every((m) => m.targetField.startsWith("g:")),
			).toBe(true);

			// Facebook mappings do not use g: prefix
			expect(
				facebook.fieldMappings.every((m) => !m.targetField.startsWith("g:")),
			).toBe(true);
		});

		it("microsoft channel uses the same mappings as google-shopping", async () => {
			const google = await controller.createFeed({
				name: "Google",
				slug: "google",
				channel: "google-shopping",
			});
			const microsoft = await controller.createFeed({
				name: "Microsoft",
				slug: "microsoft",
				channel: "microsoft",
			});

			expect(google.fieldMappings.length).toBe(microsoft.fieldMappings.length);
			for (let i = 0; i < google.fieldMappings.length; i++) {
				expect(google.fieldMappings[i].targetField).toBe(
					microsoft.fieldMappings[i].targetField,
				);
			}
		});

		it("pinterest and tiktok channels use same mappings as facebook", async () => {
			const facebook = await controller.createFeed({
				name: "Facebook",
				slug: "facebook",
				channel: "facebook",
			});
			const pinterest = await controller.createFeed({
				name: "Pinterest",
				slug: "pinterest",
				channel: "pinterest",
			});
			const tiktok = await controller.createFeed({
				name: "TikTok",
				slug: "tiktok",
				channel: "tiktok",
			});

			expect(facebook.fieldMappings.length).toBe(
				pinterest.fieldMappings.length,
			);
			expect(facebook.fieldMappings.length).toBe(tiktok.fieldMappings.length);
		});

		it("updateFeed only changes specified fields, preserves others", async () => {
			const feed = await controller.createFeed({
				name: "Original",
				slug: "original",
				channel: "google-shopping",
				format: "xml",
				country: "US",
				currency: "USD",
				language: "en",
			});

			const updated = unwrap(
				await controller.updateFeed(feed.id, { name: "Updated" }),
			);

			expect(updated.name).toBe("Updated");
			expect(updated.slug).toBe("original");
			expect(updated.channel).toBe("google-shopping");
			expect(updated.format).toBe("xml");
			expect(updated.country).toBe("US");
			expect(updated.currency).toBe("USD");
			expect(updated.language).toBe("en");
		});

		it("updateFeed can change format, channel, and filters together", async () => {
			const feed = await controller.createFeed({
				name: "Multi Update",
				slug: "multi",
				channel: "google-shopping",
			});

			const updated = unwrap(
				await controller.updateFeed(feed.id, {
					format: "csv",
					channel: "facebook",
					filters: { minPrice: 10, maxPrice: 500 },
				}),
			);

			expect(updated.format).toBe("csv");
			expect(updated.channel).toBe("facebook");
			expect(updated.filters.minPrice).toBe(10);
			expect(updated.filters.maxPrice).toBe(500);
		});

		it("updateFeed can replace field mappings entirely", async () => {
			const feed = await controller.createFeed({
				name: "Remap",
				slug: "remap",
				channel: "google-shopping",
			});

			const originalMappingsCount = feed.fieldMappings.length;
			expect(originalMappingsCount).toBeGreaterThan(0);

			const newMappings = [
				{ sourceField: "title", targetField: "product_name" },
			];

			const updated = unwrap(
				await controller.updateFeed(feed.id, {
					fieldMappings: newMappings,
				}),
			);

			expect(updated.fieldMappings).toEqual(newMappings);
			expect(updated.fieldMappings.length).toBe(1);
		});

		it("deleteFeed with no items or mappings still succeeds", async () => {
			const feed = await controller.createFeed({
				name: "Empty",
				slug: "empty",
				channel: "custom",
			});

			const deleted = await controller.deleteFeed(feed.id);
			expect(deleted).toBe(true);

			const found = await controller.getFeed(feed.id);
			expect(found).toBeNull();
		});

		it("countFeeds returns 0 when no feeds exist", async () => {
			const count = await controller.countFeeds();
			expect(count).toBe(0);
		});

		it("listFeeds returns empty array when no feeds match filter", async () => {
			await controller.createFeed({
				name: "Draft Feed",
				slug: "draft",
				channel: "google-shopping",
			});

			const active = await controller.listFeeds({ status: "active" });
			expect(active).toHaveLength(0);
		});
	});

	// ── Filter combinations ─────────────────────────────────────────

	describe("filter combinations", () => {
		it("combining minPrice and maxPrice creates a price range", async () => {
			const feed = await controller.createFeed({
				name: "Price Range",
				slug: "price-range",
				channel: "google-shopping",
				filters: { minPrice: 20, maxPrice: 80 },
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ id: "cheap", price: 10 }),
					makeProduct({ id: "mid", price: 50 }),
					makeProduct({ id: "expensive", price: 100 }),
				]),
			);

			expect(result.itemCount).toBe(1);

			const midItem = await controller.getFeedItem(feed.id, "mid");
			expect(midItem?.status).toBe("valid");

			const cheapItem = await controller.getFeedItem(feed.id, "cheap");
			expect(cheapItem?.status).toBe("excluded");

			const expensiveItem = await controller.getFeedItem(feed.id, "expensive");
			expect(expensiveItem?.status).toBe("excluded");
		});

		it("requireImages + requireInStock filters stack", async () => {
			const feed = await controller.createFeed({
				name: "Strict",
				slug: "strict",
				channel: "google-shopping",
				filters: { requireImages: true, requireInStock: true },
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({
						id: "good",
						imageUrl: "https://example.com/img.jpg",
						availability: "in_stock",
					}),
					makeProduct({
						id: "no-image",
						imageUrl: undefined,
						availability: "in_stock",
					}),
					makeProduct({
						id: "out-of-stock",
						imageUrl: "https://example.com/img.jpg",
						availability: "out_of_stock",
					}),
					makeProduct({
						id: "both-bad",
						imageUrl: undefined,
						availability: "out_of_stock",
					}),
				]),
			);

			expect(result.itemCount).toBe(1);
		});

		it("includeStatuses filter restricts by product availability", async () => {
			const feed = await controller.createFeed({
				name: "Status Filter",
				slug: "status-filter",
				channel: "google-shopping",
				filters: { includeStatuses: ["in_stock", "preorder"] },
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ id: "a", availability: "in_stock" }),
					makeProduct({ id: "b", availability: "preorder" }),
					makeProduct({ id: "c", availability: "out_of_stock" }),
				]),
			);

			expect(result.itemCount).toBe(2);

			const excluded = await controller.getFeedItem(feed.id, "c");
			expect(excluded?.status).toBe("excluded");
		});

		it("includeCategories and excludeCategories can coexist", async () => {
			const feed = await controller.createFeed({
				name: "Category Combo",
				slug: "cat-combo",
				channel: "google-shopping",
				filters: {
					includeCategories: ["Electronics", "Clothing"],
					excludeCategories: ["Clothing"],
				},
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ id: "elec", category: "Electronics" }),
					makeProduct({ id: "cloth", category: "Clothing" }),
					makeProduct({ id: "food", category: "Food" }),
				]),
			);

			// Electronics passes include, Clothing passes include but fails exclude, Food fails include
			expect(result.itemCount).toBe(1);
			const elecItem = await controller.getFeedItem(feed.id, "elec");
			expect(elecItem?.status).not.toBe("excluded");
		});

		it("products without a category bypass includeCategories filter", async () => {
			const feed = await controller.createFeed({
				name: "No Category",
				slug: "no-cat",
				channel: "google-shopping",
				filters: { includeCategories: ["Electronics"] },
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ id: "no-cat", category: undefined }),
					makeProduct({ id: "elec", category: "Electronics" }),
				]),
			);

			// Product without category bypasses the filter
			expect(result.itemCount).toBe(2);
		});

		it("products without availability bypass includeStatuses filter but may fail validation", async () => {
			const feed = await controller.createFeed({
				name: "No Availability",
				slug: "no-avail",
				channel: "google-shopping",
				filters: { includeStatuses: ["in_stock"] },
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ id: "no-avail", availability: undefined }),
					makeProduct({ id: "in-stock", availability: "in_stock" }),
				]),
			);

			// Product without availability bypasses the includeStatuses filter
			// but fails validation (g:availability is required for google-shopping)
			// so itemCount only includes the valid product
			expect(result.itemCount).toBe(1);
			expect(result.errorCount).toBe(1);

			// The product without availability was not excluded by the filter
			const item = await controller.getFeedItem(feed.id, "no-avail");
			expect(item?.status).toBe("error");
		});
	});

	// ── Feed generation edge cases ──────────────────────────────────

	describe("feed generation edge cases", () => {
		it("regenerating a feed clears old items and replaces with new ones", async () => {
			const feed = await controller.createFeed({
				name: "Regenerate",
				slug: "regen",
				channel: "google-shopping",
			});

			// First generation with 3 products
			await controller.generateFeed(feed.id, [
				makeProduct({ id: "p1" }),
				makeProduct({ id: "p2" }),
				makeProduct({ id: "p3" }),
			]);

			let count = await controller.countFeedItems(feed.id);
			expect(count).toBe(3);

			// Second generation with only 1 product
			await controller.generateFeed(feed.id, [makeProduct({ id: "p4" })]);

			count = await controller.countFeedItems(feed.id);
			expect(count).toBe(1);

			// Old items should be gone
			const oldItem = await controller.getFeedItem(feed.id, "p1");
			expect(oldItem).toBeNull();

			// New item should exist
			const newItem = await controller.getFeedItem(feed.id, "p4");
			expect(newItem).not.toBeNull();
		});

		it("draft feed transitions to active after successful generation", async () => {
			const feed = await controller.createFeed({
				name: "Draft to Active",
				slug: "draft-active",
				channel: "google-shopping",
			});

			expect(feed.status).toBe("draft");

			await controller.generateFeed(feed.id, [makeProduct()]);

			const updated = unwrap(await controller.getFeed(feed.id));
			expect(updated.status).toBe("active");
		});

		it("feed with errors sets status to error", async () => {
			const feed = await controller.createFeed({
				name: "Error Feed",
				slug: "error-feed",
				channel: "google-shopping",
			});

			// Product missing required fields (url and imageUrl)
			await controller.generateFeed(feed.id, [
				makeProduct({
					id: "broken",
					url: undefined,
					imageUrl: undefined,
				}),
			]);

			const updated = unwrap(await controller.getFeed(feed.id));
			expect(updated.status).toBe("error");
			expect(updated.errorCount).toBeGreaterThan(0);
		});

		it("paused feed stays paused after successful generation", async () => {
			const feed = await controller.createFeed({
				name: "Paused",
				slug: "paused",
				channel: "google-shopping",
			});

			await controller.updateFeed(feed.id, { status: "paused" });

			await controller.generateFeed(feed.id, [makeProduct()]);

			const updated = unwrap(await controller.getFeed(feed.id));
			// Paused is not draft, so it stays paused (unless there are errors)
			expect(updated.status).toBe("paused");
		});

		it("active feed stays active after successful re-generation", async () => {
			const feed = await controller.createFeed({
				name: "Stay Active",
				slug: "stay-active",
				channel: "google-shopping",
			});

			await controller.updateFeed(feed.id, { status: "active" });
			await controller.generateFeed(feed.id, [makeProduct()]);

			const updated = unwrap(await controller.getFeed(feed.id));
			expect(updated.status).toBe("active");
		});

		it("error items are excluded from the output", async () => {
			const feed = await controller.createFeed({
				name: "Mixed",
				slug: "mixed",
				channel: "google-shopping",
				format: "json",
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ id: "good" }),
					makeProduct({
						id: "bad",
						url: undefined,
						imageUrl: undefined,
					}),
				]),
			);

			const parsed = JSON.parse(result.output);
			// Only the good product should be in the output
			expect(parsed.products).toHaveLength(1);
			expect(result.itemCount).toBe(1);
			expect(result.errorCount).toBe(1);
		});

		it("warning items are included in the output", async () => {
			const feed = await controller.createFeed({
				name: "Warnings",
				slug: "warnings",
				channel: "google-shopping",
				format: "json",
			});

			const longTitle = "A".repeat(160);
			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ id: "warn-product", title: longTitle }),
				]),
			);

			expect(result.warningCount).toBe(1);
			expect(result.itemCount).toBe(1); // Still included
			const parsed = JSON.parse(result.output);
			expect(parsed.products).toHaveLength(1);
		});

		it("empty products array produces valid output with zero items", async () => {
			const feed = await controller.createFeed({
				name: "Empty",
				slug: "empty",
				channel: "google-shopping",
			});

			const result = unwrap(await controller.generateFeed(feed.id, []));

			expect(result.itemCount).toBe(0);
			expect(result.errorCount).toBe(0);
			expect(result.warningCount).toBe(0);
			// XML should still have the shell structure
			expect(result.output).toContain("<?xml");
			expect(result.output).toContain("</rss>");
		});

		it("generating with empty products still transitions draft to active", async () => {
			const feed = await controller.createFeed({
				name: "Empty Draft",
				slug: "empty-draft",
				channel: "google-shopping",
			});

			await controller.generateFeed(feed.id, []);

			const updated = unwrap(await controller.getFeed(feed.id));
			expect(updated.status).toBe("active");
		});
	});

	// ── Category mapping during generation ──────────────────────────

	describe("category mapping during generation", () => {
		it("category mapping replaces store category with channel category in output", async () => {
			const feed = await controller.createFeed({
				name: "Cat Map",
				slug: "cat-map",
				channel: "facebook",
				format: "json",
			});

			await controller.addCategoryMapping(feed.id, {
				storeCategory: "Electronics",
				channelCategory: "Consumer Electronics",
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ category: "Electronics" }),
				]),
			);

			const parsed = JSON.parse(result.output);
			expect(parsed.products[0].google_product_category).toBe(
				"Consumer Electronics",
			);
		});

		it("products without matching category mapping keep original category", async () => {
			const feed = await controller.createFeed({
				name: "No Map Match",
				slug: "no-map-match",
				channel: "facebook",
				format: "json",
			});

			await controller.addCategoryMapping(feed.id, {
				storeCategory: "Electronics",
				channelCategory: "Consumer Electronics",
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ category: "Clothing" }),
				]),
			);

			const parsed = JSON.parse(result.output);
			expect(parsed.products[0].google_product_category).toBe("Clothing");
		});

		it("multiple category mappings work independently", async () => {
			const feed = await controller.createFeed({
				name: "Multi Map",
				slug: "multi-map",
				channel: "facebook",
				format: "json",
			});

			await controller.addCategoryMapping(feed.id, {
				storeCategory: "Electronics",
				channelCategory: "Consumer Electronics",
			});
			await controller.addCategoryMapping(feed.id, {
				storeCategory: "Clothing",
				channelCategory: "Apparel & Accessories",
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ id: "elec", category: "Electronics" }),
					makeProduct({ id: "cloth", category: "Clothing" }),
				]),
			);

			const parsed = JSON.parse(result.output);
			const elec = parsed.products.find(
				(p: Record<string, unknown>) =>
					p.google_product_category === "Consumer Electronics",
			);
			const cloth = parsed.products.find(
				(p: Record<string, unknown>) =>
					p.google_product_category === "Apparel & Accessories",
			);
			expect(elec).toBeDefined();
			expect(cloth).toBeDefined();
		});

		it("category mappings are scoped to their feed", async () => {
			const feed1 = await controller.createFeed({
				name: "Feed 1",
				slug: "feed-1",
				channel: "facebook",
				format: "json",
			});
			const feed2 = await controller.createFeed({
				name: "Feed 2",
				slug: "feed-2",
				channel: "facebook",
				format: "json",
			});

			await controller.addCategoryMapping(feed1.id, {
				storeCategory: "Electronics",
				channelCategory: "Feed1 Electronics",
			});
			await controller.addCategoryMapping(feed2.id, {
				storeCategory: "Electronics",
				channelCategory: "Feed2 Electronics",
			});

			const result1 = unwrap(
				await controller.generateFeed(feed1.id, [
					makeProduct({ category: "Electronics" }),
				]),
			);
			const result2 = unwrap(
				await controller.generateFeed(feed2.id, [
					makeProduct({ category: "Electronics" }),
				]),
			);

			const parsed1 = JSON.parse(result1.output);
			const parsed2 = JSON.parse(result2.output);
			expect(parsed1.products[0].google_product_category).toBe(
				"Feed1 Electronics",
			);
			expect(parsed2.products[0].google_product_category).toBe(
				"Feed2 Electronics",
			);
		});

		it("deleting a category mapping stops it from affecting generation", async () => {
			const feed = await controller.createFeed({
				name: "Delete Map",
				slug: "delete-map",
				channel: "facebook",
				format: "json",
			});

			const mapping = await controller.addCategoryMapping(feed.id, {
				storeCategory: "Electronics",
				channelCategory: "Mapped Category",
			});

			// Generate with mapping
			const result1 = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ category: "Electronics" }),
				]),
			);
			const parsed1 = JSON.parse(result1.output);
			expect(parsed1.products[0].google_product_category).toBe(
				"Mapped Category",
			);

			// Delete the mapping and regenerate
			await controller.deleteCategoryMapping(mapping.id);

			const result2 = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ category: "Electronics" }),
				]),
			);
			const parsed2 = JSON.parse(result2.output);
			expect(parsed2.products[0].google_product_category).toBe("Electronics");
		});
	});

	// ── Field transforms edge cases ─────────────────────────────────

	describe("field transform edge cases", () => {
		it("transforms chain correctly: prefix applied to product value", async () => {
			const feed = await controller.createFeed({
				name: "Prefix Test",
				slug: "prefix-test",
				channel: "custom",
				fieldMappings: [
					{
						sourceField: "id",
						targetField: "item_id",
						transform: "prefix",
						transformValue: "STORE-",
					},
				],
				format: "json",
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [makeProduct({ id: "abc123" })]),
			);

			const parsed = JSON.parse(result.output);
			expect(parsed.products[0].item_id).toBe("STORE-abc123");
		});

		it("suffix transform appends value", async () => {
			const feed = await controller.createFeed({
				name: "Suffix Test",
				slug: "suffix-test",
				channel: "custom",
				fieldMappings: [
					{
						sourceField: "title",
						targetField: "name",
						transform: "suffix",
						transformValue: " [SALE]",
					},
				],
				format: "json",
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ title: "Widget" }),
				]),
			);

			const parsed = JSON.parse(result.output);
			expect(parsed.products[0].name).toBe("Widget [SALE]");
		});

		it("template transform replaces {value} placeholder", async () => {
			const feed = await controller.createFeed({
				name: "Template Test",
				slug: "template-test",
				channel: "custom",
				fieldMappings: [
					{
						sourceField: "price",
						targetField: "display_price",
						transform: "template",
						// biome-ignore lint/suspicious/noTemplateCurlyInString: literal template pattern for feed transform
						transformValue: "${value} USD",
					},
				],
				format: "json",
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [makeProduct({ price: 19.99 })]),
			);

			const parsed = JSON.parse(result.output);
			expect(parsed.products[0].display_price).toBe("$19.99 USD");
		});

		it("defaultValue is used when source field is missing", async () => {
			const feed = await controller.createFeed({
				name: "Default Test",
				slug: "default-test",
				channel: "custom",
				fieldMappings: [
					{
						sourceField: "color",
						targetField: "color",
						defaultValue: "N/A",
					},
				],
				format: "json",
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ color: undefined }),
				]),
			);

			const parsed = JSON.parse(result.output);
			expect(parsed.products[0].color).toBe("N/A");
		});

		it("transform is not applied when source is empty and default is used", async () => {
			const feed = await controller.createFeed({
				name: "Default No Transform",
				slug: "default-no-transform",
				channel: "custom",
				fieldMappings: [
					{
						sourceField: "color",
						targetField: "color",
						transform: "uppercase",
						defaultValue: "unknown",
					},
				],
				format: "json",
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ color: undefined }),
				]),
			);

			const parsed = JSON.parse(result.output);
			// defaultValue is returned as-is, no transform applied
			expect(parsed.products[0].color).toBe("unknown");
		});

		it("customFields take priority over standard fields for sourceField resolution", async () => {
			const feed = await controller.createFeed({
				name: "Custom Priority",
				slug: "custom-priority",
				channel: "custom",
				fieldMappings: [
					{
						sourceField: "title",
						targetField: "name",
					},
				],
				format: "json",
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({
						title: "Standard Title",
						customFields: { title: "Custom Title" },
					}),
				]),
			);

			const parsed = JSON.parse(result.output);
			// customFields are checked first
			expect(parsed.products[0].name).toBe("Custom Title");
		});

		it("field mapped to non-existent source and no default produces no output key", async () => {
			const feed = await controller.createFeed({
				name: "Missing Source",
				slug: "missing-source",
				channel: "custom",
				fieldMappings: [
					{
						sourceField: "nonexistent_field",
						targetField: "output_field",
					},
				],
				format: "json",
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [makeProduct()]),
			);

			const parsed = JSON.parse(result.output);
			expect(parsed.products[0].output_field).toBeUndefined();
		});
	});

	// ── Output format edge cases ────────────────────────────────────

	describe("output format edge cases", () => {
		it("XML output has proper RSS structure", async () => {
			const feed = await controller.createFeed({
				name: "XML Structure",
				slug: "xml-structure",
				channel: "google-shopping",
				format: "xml",
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [makeProduct()]),
			);

			expect(result.output).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(result.output).toContain(
				'<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">',
			);
			expect(result.output).toContain("<channel>");
			expect(result.output).toContain("<item>");
			expect(result.output).toContain("</item>");
			expect(result.output).toContain("</channel>");
			expect(result.output).toContain("</rss>");
		});

		it("XML escapes special characters in all fields", async () => {
			const feed = await controller.createFeed({
				name: "XML Escape All",
				slug: "xml-escape-all",
				channel: "google-shopping",
				format: "xml",
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({
						title: 'Beans & Rice <"Organic">',
						description: "Bob's Best & Finest",
					}),
				]),
			);

			expect(result.output).toContain("&amp;");
			expect(result.output).toContain("&lt;");
			expect(result.output).toContain("&gt;");
			expect(result.output).toContain("&quot;");
			expect(result.output).toContain("&apos;");
		});

		it("CSV escapes fields containing commas", async () => {
			const feed = await controller.createFeed({
				name: "CSV Comma",
				slug: "csv-comma",
				channel: "custom",
				format: "csv",
				fieldMappings: [{ sourceField: "title", targetField: "title" }],
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ title: "Widget, Deluxe" }),
				]),
			);

			expect(result.output).toContain('"Widget, Deluxe"');
		});

		it("CSV escapes fields containing double quotes", async () => {
			const feed = await controller.createFeed({
				name: "CSV Quotes",
				slug: "csv-quotes",
				channel: "custom",
				format: "csv",
				fieldMappings: [{ sourceField: "title", targetField: "title" }],
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ title: 'The "Best" Widget' }),
				]),
			);

			expect(result.output).toContain('"The ""Best"" Widget"');
		});

		it("TSV does not escape commas (tab-separated)", async () => {
			const feed = await controller.createFeed({
				name: "TSV No Escape",
				slug: "tsv-no-escape",
				channel: "custom",
				format: "tsv",
				fieldMappings: [{ sourceField: "title", targetField: "title" }],
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ title: "Widget, Deluxe" }),
				]),
			);

			// No quoting in TSV format
			expect(result.output).toContain("Widget, Deluxe");
			expect(result.output).not.toContain('"Widget, Deluxe"');
		});

		it("CSV output has headers row followed by data row", async () => {
			const feed = await controller.createFeed({
				name: "CSV Headers",
				slug: "csv-headers",
				channel: "custom",
				format: "csv",
				fieldMappings: [
					{ sourceField: "title", targetField: "name" },
					{ sourceField: "price", targetField: "price" },
				],
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ title: "Widget", price: 10 }),
				]),
			);

			const lines = result.output.split("\n");
			expect(lines[0]).toContain("name");
			expect(lines[0]).toContain("price");
			expect(lines[1]).toContain("Widget");
			expect(lines[1]).toContain("10");
		});

		it("JSON output wraps items in products array", async () => {
			const feed = await controller.createFeed({
				name: "JSON Wrap",
				slug: "json-wrap",
				channel: "custom",
				format: "json",
				fieldMappings: [{ sourceField: "title", targetField: "name" }],
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ title: "A" }),
					makeProduct({ title: "B" }),
				]),
			);

			const parsed = JSON.parse(result.output);
			expect(parsed).toHaveProperty("products");
			expect(parsed.products).toHaveLength(2);
		});

		it("CSV with no items produces empty string", async () => {
			const feed = await controller.createFeed({
				name: "Empty CSV",
				slug: "empty-csv",
				channel: "google-shopping",
				format: "csv",
				filters: { minPrice: 99999 },
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [makeProduct({ price: 1 })]),
			);

			expect(result.output).toBe("");
		});

		it("JSON with no items produces empty products array", async () => {
			const feed = await controller.createFeed({
				name: "Empty JSON",
				slug: "empty-json",
				channel: "google-shopping",
				format: "json",
				filters: { minPrice: 99999 },
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [makeProduct({ price: 1 })]),
			);

			const parsed = JSON.parse(result.output);
			expect(parsed.products).toHaveLength(0);
		});
	});

	// ── Validation edge cases ───────────────────────────────────────

	describe("validation edge cases", () => {
		it("validateFeed reports no-mappings error for custom feed with no mappings", async () => {
			const feed = await controller.createFeed({
				name: "No Mappings",
				slug: "no-mappings",
				channel: "custom",
			});

			const issues = await controller.validateFeed(feed.id);
			const mappingIssue = issues.find((i) => i.field === "fieldMappings");
			expect(mappingIssue).toBeDefined();
			expect(mappingIssue?.severity).toBe("error");
		});

		it("validateFeed for google-shopping with only one mapping warns about missing required fields", async () => {
			const feed = await controller.createFeed({
				name: "Partial Google",
				slug: "partial-google",
				channel: "google-shopping",
				fieldMappings: [{ sourceField: "title", targetField: "g:title" }],
			});

			const issues = await controller.validateFeed(feed.id);
			const warnings = issues.filter((i) => i.severity === "warning");
			// Should warn about missing g:id, g:link, g:price, g:availability, g:image_link
			expect(warnings.length).toBeGreaterThanOrEqual(5);
		});

		it("validateFeed collects item-level issues from generation", async () => {
			const feed = await controller.createFeed({
				name: "Item Issues",
				slug: "item-issues",
				channel: "google-shopping",
			});

			await controller.generateFeed(feed.id, [
				makeProduct({
					url: undefined,
					imageUrl: undefined,
				}),
			]);

			const issues = await controller.validateFeed(feed.id);
			const errors = issues.filter((i) => i.severity === "error");
			// Should have errors for missing g:link and g:image_link
			expect(errors.some((e) => e.field === "g:link")).toBe(true);
			expect(errors.some((e) => e.field === "g:image_link")).toBe(true);
		});

		it("title >150 chars generates warning in feed item", async () => {
			const feed = await controller.createFeed({
				name: "Long Title",
				slug: "long-title",
				channel: "google-shopping",
			});

			const longTitle = "X".repeat(160);
			await controller.generateFeed(feed.id, [
				makeProduct({ id: "long-title-product", title: longTitle }),
			]);

			const item = unwrap(
				await controller.getFeedItem(feed.id, "long-title-product"),
			);
			expect(item.status).toBe("warning");
			expect(item.issues.some((i) => i.field === "g:title")).toBe(true);
			expect(
				item.issues.some(
					(i) => i.severity === "warning" && i.message.includes("150"),
				),
			).toBe(true);
		});

		it("description >5000 chars generates warning in feed item", async () => {
			const feed = await controller.createFeed({
				name: "Long Desc",
				slug: "long-desc",
				channel: "google-shopping",
			});

			const longDesc = "Y".repeat(5010);
			await controller.generateFeed(feed.id, [
				makeProduct({ id: "long-desc-product", description: longDesc }),
			]);

			const item = unwrap(
				await controller.getFeedItem(feed.id, "long-desc-product"),
			);
			expect(item.status).toBe("warning");
			expect(item.issues.some((i) => i.field === "g:description")).toBe(true);
		});

		it("both title and description warnings accumulate", async () => {
			const feed = await controller.createFeed({
				name: "Both Warnings",
				slug: "both-warnings",
				channel: "google-shopping",
			});

			const longTitle = "T".repeat(160);
			const longDesc = "D".repeat(5010);
			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({
						id: "both",
						title: longTitle,
						description: longDesc,
					}),
				]),
			);

			expect(result.warningCount).toBe(1); // One product with warnings
			expect(result.itemCount).toBe(1); // Still included

			const item = unwrap(await controller.getFeedItem(feed.id, "both"));
			const warnings = item.issues.filter((i) => i.severity === "warning");
			expect(warnings.length).toBe(2);
		});

		it("facebook channel validates different required fields than google", async () => {
			const feed = await controller.createFeed({
				name: "Facebook Validate",
				slug: "fb-validate",
				channel: "facebook",
				fieldMappings: [{ sourceField: "title", targetField: "title" }],
			});

			const issues = await controller.validateFeed(feed.id);
			const warnings = issues.filter((i) => i.severity === "warning");
			// Facebook requires: id, title, link, price, availability, image_link
			// Only title is mapped, so 5 others should be warned
			expect(warnings.some((w) => w.field === "id")).toBe(true);
			expect(warnings.some((w) => w.field === "link")).toBe(true);
		});

		it("custom channel has no required fields, no warnings for missing mappings", async () => {
			const feed = await controller.createFeed({
				name: "Custom No Warn",
				slug: "custom-no-warn",
				channel: "custom",
				fieldMappings: [{ sourceField: "title", targetField: "name" }],
			});

			const issues = await controller.validateFeed(feed.id);
			// Custom has no required fields, so no warnings about missing fields
			const warnings = issues.filter((i) => i.severity === "warning");
			expect(warnings).toHaveLength(0);
		});
	});

	// ── Feed output caching ─────────────────────────────────────────

	describe("feed output caching", () => {
		it("getFeedOutput returns the same output as generation result", async () => {
			const feed = await controller.createFeed({
				name: "Cache Test",
				slug: "cache-test",
				channel: "google-shopping",
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [makeProduct()]),
			);

			const cached = await controller.getFeedOutput(feed.id);
			expect(cached).toBe(result.output);
		});

		it("regeneration replaces cached output", async () => {
			const feed = await controller.createFeed({
				name: "Replace Cache",
				slug: "replace-cache",
				channel: "custom",
				fieldMappings: [{ sourceField: "title", targetField: "name" }],
				format: "json",
			});

			await controller.generateFeed(feed.id, [makeProduct({ title: "First" })]);

			const first = await controller.getFeedOutput(feed.id);
			expect(first).toContain("First");

			await controller.generateFeed(feed.id, [
				makeProduct({ title: "Second" }),
			]);

			const second = await controller.getFeedOutput(feed.id);
			expect(second).toContain("Second");
			expect(second).not.toContain("First");
		});

		it("feed lastGeneratedAt is set after generation", async () => {
			const feed = await controller.createFeed({
				name: "Timestamp",
				slug: "timestamp",
				channel: "google-shopping",
			});

			expect(feed.lastGeneratedAt).toBeUndefined();

			await controller.generateFeed(feed.id, [makeProduct()]);

			const updated = unwrap(await controller.getFeed(feed.id));
			expect(updated.lastGeneratedAt).toBeDefined();
		});
	});

	// ── Category mapping CRUD edge cases ────────────────────────────

	describe("category mapping CRUD edge cases", () => {
		it("updateCategoryMapping preserves storeCategory and feedId", async () => {
			const feed = await controller.createFeed({
				name: "Map CRUD",
				slug: "map-crud",
				channel: "google-shopping",
			});

			const mapping = await controller.addCategoryMapping(feed.id, {
				storeCategory: "Electronics",
				channelCategory: "Old Channel Cat",
				channelCategoryId: "111",
			});

			const updated = unwrap(
				await controller.updateCategoryMapping(mapping.id, {
					channelCategory: "New Channel Cat",
					channelCategoryId: "222",
				}),
			);

			expect(updated.storeCategory).toBe("Electronics");
			expect(updated.feedId).toBe(feed.id);
			expect(updated.channelCategory).toBe("New Channel Cat");
			expect(updated.channelCategoryId).toBe("222");
		});

		it("addCategoryMapping without channelCategoryId omits it", async () => {
			const feed = await controller.createFeed({
				name: "No Cat ID",
				slug: "no-cat-id",
				channel: "google-shopping",
			});

			const mapping = await controller.addCategoryMapping(feed.id, {
				storeCategory: "Toys",
				channelCategory: "Toys & Games",
			});

			expect(mapping.channelCategoryId).toBeUndefined();
		});

		it("deleteFeed cascade-deletes all category mappings for that feed", async () => {
			const feed = await controller.createFeed({
				name: "Cascade",
				slug: "cascade",
				channel: "google-shopping",
			});

			await controller.addCategoryMapping(feed.id, {
				storeCategory: "A",
				channelCategory: "X",
			});
			await controller.addCategoryMapping(feed.id, {
				storeCategory: "B",
				channelCategory: "Y",
			});

			let mappings = await controller.listCategoryMappings(feed.id);
			expect(mappings).toHaveLength(2);

			await controller.deleteFeed(feed.id);

			mappings = await controller.listCategoryMappings(feed.id);
			expect(mappings).toHaveLength(0);
		});
	});

	// ── Stats edge cases ────────────────────────────────────────────

	describe("stats edge cases", () => {
		it("stats reflect error and warning items", async () => {
			const feed = await controller.createFeed({
				name: "Stats Feed",
				slug: "stats-feed",
				channel: "google-shopping",
			});

			await controller.generateFeed(feed.id, [
				makeProduct({ id: "good" }),
				makeProduct({
					id: "bad",
					url: undefined,
					imageUrl: undefined,
				}),
				makeProduct({
					id: "warn",
					title: "A".repeat(160),
				}),
			]);

			const stats = await controller.getStats();
			expect(stats.totalFeeds).toBe(1);
			expect(stats.totalItems).toBe(3);
			expect(stats.errorItems).toBe(1);
			expect(stats.warningItems).toBe(1);
		});

		it("stats count active feeds correctly across multiple feeds", async () => {
			const f1 = await controller.createFeed({
				name: "Active 1",
				slug: "active-1",
				channel: "google-shopping",
			});
			await controller.updateFeed(f1.id, { status: "active" });

			const f2 = await controller.createFeed({
				name: "Active 2",
				slug: "active-2",
				channel: "facebook",
			});
			await controller.updateFeed(f2.id, { status: "active" });

			await controller.createFeed({
				name: "Draft",
				slug: "draft",
				channel: "custom",
			});

			await controller.createFeed({
				name: "Paused",
				slug: "paused",
				channel: "pinterest",
			});

			const stats = await controller.getStats();
			expect(stats.totalFeeds).toBe(4);
			expect(stats.activeFeeds).toBe(2);
		});

		it("stats aggregate items across multiple feeds", async () => {
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

			await controller.generateFeed(feed1.id, [makeProduct(), makeProduct()]);
			await controller.generateFeed(feed2.id, [
				makeProduct(),
				makeProduct(),
				makeProduct(),
			]);

			const stats = await controller.getStats();
			expect(stats.totalItems).toBe(5);
		});
	});

	// ── Multi-channel validation ────────────────────────────────────

	describe("multi-channel validation differences", () => {
		it("google-shopping requires g:-prefixed fields", async () => {
			const feed = await controller.createFeed({
				name: "Google Req",
				slug: "google-req",
				channel: "google-shopping",
			});

			// Product missing url and imageUrl will fail g:link and g:image_link
			unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({
						id: "missing-fields",
						url: undefined,
						imageUrl: undefined,
					}),
				]),
			);

			const item = unwrap(
				await controller.getFeedItem(feed.id, "missing-fields"),
			);
			expect(item.status).toBe("error");
			expect(
				item.issues.some((i) => i.field === "g:link" && i.severity === "error"),
			).toBe(true);
			expect(
				item.issues.some(
					(i) => i.field === "g:image_link" && i.severity === "error",
				),
			).toBe(true);
		});

		it("facebook requires non-prefixed fields", async () => {
			const feed = await controller.createFeed({
				name: "Facebook Req",
				slug: "facebook-req",
				channel: "facebook",
			});

			unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({
						id: "missing-fb",
						url: undefined,
						imageUrl: undefined,
					}),
				]),
			);

			const item = unwrap(await controller.getFeedItem(feed.id, "missing-fb"));
			expect(item.status).toBe("error");
			expect(
				item.issues.some((i) => i.field === "link" && i.severity === "error"),
			).toBe(true);
			expect(
				item.issues.some(
					(i) => i.field === "image_link" && i.severity === "error",
				),
			).toBe(true);
		});

		it("custom channel has no validation errors for missing fields", async () => {
			const feed = await controller.createFeed({
				name: "Custom No Errors",
				slug: "custom-no-errors",
				channel: "custom",
				fieldMappings: [{ sourceField: "title", targetField: "name" }],
			});

			const result = unwrap(
				await controller.generateFeed(feed.id, [
					makeProduct({ id: "custom-product" }),
				]),
			);

			expect(result.errorCount).toBe(0);

			const item = unwrap(
				await controller.getFeedItem(feed.id, "custom-product"),
			);
			expect(item.status).toBe("valid");
			expect(item.issues).toHaveLength(0);
		});
	});

	// ── Full lifecycle ──────────────────────────────────────────────

	describe("full lifecycle", () => {
		it("complete feed workflow: create, configure, generate, validate, output", async () => {
			// 1. Create a feed
			const feed = await controller.createFeed({
				name: "Google US Feed",
				slug: "google-us",
				channel: "google-shopping",
				country: "US",
				currency: "USD",
				language: "en",
				filters: {
					requireImages: true,
					requireInStock: true,
					minPrice: 5,
				},
			});

			expect(feed.status).toBe("draft");
			expect(feed.itemCount).toBe(0);

			// 2. Add category mappings
			await controller.addCategoryMapping(feed.id, {
				storeCategory: "Electronics",
				channelCategory: "Electronics > Computers",
				channelCategoryId: "1234",
			});
			await controller.addCategoryMapping(feed.id, {
				storeCategory: "Clothing",
				channelCategory: "Apparel & Accessories > Clothing",
				channelCategoryId: "5678",
			});

			// 3. Generate with a mix of products
			const products = [
				makeProduct({
					id: "p1",
					title: "Laptop Pro",
					price: 999,
					category: "Electronics",
					imageUrl: "https://example.com/laptop.jpg",
					availability: "in_stock",
				}),
				makeProduct({
					id: "p2",
					title: "T-Shirt",
					price: 25,
					category: "Clothing",
					imageUrl: "https://example.com/shirt.jpg",
					availability: "in_stock",
				}),
				makeProduct({
					id: "p3",
					title: "Cheap Item",
					price: 2,
					imageUrl: "https://example.com/cheap.jpg",
					availability: "in_stock",
				}), // Filtered out by minPrice
				makeProduct({
					id: "p4",
					title: "No Image Item",
					price: 50,
					imageUrl: undefined,
					availability: "in_stock",
				}), // Filtered out by requireImages
				makeProduct({
					id: "p5",
					title: "Out of Stock Item",
					price: 50,
					imageUrl: "https://example.com/oos.jpg",
					availability: "out_of_stock",
				}), // Filtered out by requireInStock
			];

			const result = unwrap(await controller.generateFeed(feed.id, products));

			// Only p1 and p2 should pass all filters
			expect(result.itemCount).toBe(2);
			expect(result.errorCount).toBe(0);

			// 4. Verify feed status changed
			const updatedFeed = unwrap(await controller.getFeed(feed.id));
			expect(updatedFeed.status).toBe("active");
			expect(updatedFeed.itemCount).toBe(2);
			expect(updatedFeed.lastGeneratedAt).toBeDefined();

			// 5. Verify items
			const allItems = await controller.getFeedItems(feed.id);
			expect(allItems).toHaveLength(5); // All products create items

			const validItems = await controller.getFeedItems(feed.id, {
				status: "valid",
			});
			expect(validItems).toHaveLength(2);

			const excludedItems = await controller.getFeedItems(feed.id, {
				status: "excluded",
			});
			expect(excludedItems).toHaveLength(3);

			// 6. Verify category mapping was applied in output
			expect(result.output).toContain("Electronics &gt; Computers");

			// 7. Verify cached output matches
			const cached = await controller.getFeedOutput(feed.id);
			expect(cached).toBe(result.output);

			// 8. Validate
			const issues = await controller.validateFeed(feed.id);
			// No errors expected since all valid products have all required fields
			const errors = issues.filter((i) => i.severity === "error");
			expect(errors).toHaveLength(0);

			// 9. Check stats
			const stats = await controller.getStats();
			expect(stats.totalFeeds).toBe(1);
			expect(stats.activeFeeds).toBe(1);
			expect(stats.totalItems).toBe(5);
		});

		it("feed deletion cleans up everything", async () => {
			const feed = await controller.createFeed({
				name: "To Delete",
				slug: "to-delete",
				channel: "google-shopping",
			});

			await controller.addCategoryMapping(feed.id, {
				storeCategory: "A",
				channelCategory: "B",
			});

			await controller.generateFeed(feed.id, [makeProduct(), makeProduct()]);

			// Verify items and mappings exist
			expect(await controller.countFeedItems(feed.id)).toBe(2);
			expect((await controller.listCategoryMappings(feed.id)).length).toBe(1);

			// Delete
			const deleted = await controller.deleteFeed(feed.id);
			expect(deleted).toBe(true);

			// Verify everything is gone
			expect(await controller.getFeed(feed.id)).toBeNull();
			expect(await controller.getFeedOutput(feed.id)).toBeNull();
			expect(await controller.countFeedItems(feed.id)).toBe(0);
			expect((await controller.listCategoryMappings(feed.id)).length).toBe(0);
		});
	});

	// ── Feed item ID construction ───────────────────────────────────

	describe("feed item ID construction", () => {
		it("feed item ID is feedId_productId", async () => {
			const feed = await controller.createFeed({
				name: "ID Test",
				slug: "id-test",
				channel: "google-shopping",
			});

			await controller.generateFeed(feed.id, [
				makeProduct({ id: "product-abc" }),
			]);

			const item = unwrap(await controller.getFeedItem(feed.id, "product-abc"));
			expect(item.id).toBe(`${feed.id}_product-abc`);
			expect(item.feedId).toBe(feed.id);
			expect(item.productId).toBe("product-abc");
		});
	});

	// ── Multiple feeds isolation ────────────────────────────────────

	describe("multiple feeds isolation", () => {
		it("generating one feed does not affect another feed's items", async () => {
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

			await controller.generateFeed(feed1.id, [
				makeProduct({ id: "p1" }),
				makeProduct({ id: "p2" }),
			]);
			await controller.generateFeed(feed2.id, [makeProduct({ id: "p3" })]);

			expect(await controller.countFeedItems(feed1.id)).toBe(2);
			expect(await controller.countFeedItems(feed2.id)).toBe(1);

			// Regenerating feed1 shouldn't affect feed2
			await controller.generateFeed(feed1.id, [makeProduct({ id: "p4" })]);

			expect(await controller.countFeedItems(feed1.id)).toBe(1);
			expect(await controller.countFeedItems(feed2.id)).toBe(1);
		});

		it("deleting one feed does not affect another feed", async () => {
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

			await controller.generateFeed(feed1.id, [makeProduct()]);
			await controller.generateFeed(feed2.id, [makeProduct()]);

			await controller.deleteFeed(feed1.id);

			// Feed2 should still be intact
			const f2 = await controller.getFeed(feed2.id);
			expect(f2).not.toBeNull();
			expect(await controller.countFeedItems(feed2.id)).toBe(1);
		});
	});
});
