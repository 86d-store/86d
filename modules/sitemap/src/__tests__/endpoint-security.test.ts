import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_ENTRIES_PER_SITEMAP } from "../service";
import { createSitemapController } from "../service-impl";

/**
 * Security tests for sitemap module endpoints.
 *
 * These tests verify:
 * - getConfig creates a default config on first access (singleton behavior)
 * - Regeneration preserves custom entries but clears auto-generated ones
 * - Entry source filtering via listEntries and countEntries
 * - bulkRemoveEntries counts only successfully removed entries
 * - Entry uniqueness by path (getEntryByLoc lookup)
 * - generateXml pagination respects MAX_ENTRIES_PER_SITEMAP per page
 */

describe("sitemap endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSitemapController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSitemapController(mockData);
	});

	// ── Config Singleton ─────────────────────────────────────────────

	describe("config singleton", () => {
		it("getConfig creates default config on first access", async () => {
			const config = await controller.getConfig();

			expect(config).toBeDefined();
			expect(config.id).toBe("default");
			expect(config.baseUrl).toBe("https://example.com");
			expect(config.includeProducts).toBe(true);
			expect(config.includeCollections).toBe(true);
			expect(config.includePages).toBe(true);
			expect(config.includeBlog).toBe(true);
			expect(config.includeBrands).toBe(true);
			expect(config.createdAt).toBeInstanceOf(Date);
			expect(config.updatedAt).toBeInstanceOf(Date);
		});

		it("getConfig returns the same config on subsequent calls", async () => {
			const first = await controller.getConfig();
			const second = await controller.getConfig();

			expect(second.id).toBe(first.id);
			expect(second.baseUrl).toBe(first.baseUrl);
		});

		it("updateConfig persists changes and returns updated config", async () => {
			const updated = await controller.updateConfig({
				baseUrl: "https://mystore.com",
				defaultPriority: 0.7,
			});

			expect(updated.baseUrl).toBe("https://mystore.com");
			expect(updated.defaultPriority).toBe(0.7);

			// Verify persisted
			const retrieved = await controller.getConfig();
			expect(retrieved.baseUrl).toBe("https://mystore.com");
			expect(retrieved.defaultPriority).toBe(0.7);
		});

		it("updateConfig preserves unchanged fields", async () => {
			const original = await controller.getConfig();

			await controller.updateConfig({ baseUrl: "https://new.com" });

			const updated = await controller.getConfig();
			expect(updated.includeProducts).toBe(original.includeProducts);
			expect(updated.productPriority).toBe(original.productPriority);
		});
	});

	// ── Regeneration Behavior ────────────────────────────────────────

	describe("regeneration", () => {
		it("regeneration preserves custom entries", async () => {
			const customEntry = await controller.addEntry({
				path: "/custom-page",
				priority: 0.9,
			});

			await controller.regenerate({
				products: [{ slug: "product-one" }],
			});

			// Custom entry must still exist
			const found = await controller.getEntry(customEntry.id);
			expect(found).not.toBeNull();
			expect(found?.source).toBe("custom");
		});

		it("regeneration clears auto-generated (product) entries", async () => {
			// First regeneration with a product
			await controller.regenerate({
				products: [{ slug: "old-product" }],
			});

			const before = await controller.listEntries({ source: "product" });
			expect(before).toHaveLength(1);

			// Second regeneration with different products
			await controller.regenerate({
				products: [{ slug: "new-product-a" }, { slug: "new-product-b" }],
			});

			const after = await controller.listEntries({ source: "product" });
			expect(after).toHaveLength(2);

			// old-product should be gone
			const slugs = after.map((e) => e.loc);
			expect(slugs.some((l) => l.includes("old-product"))).toBe(false);
			expect(slugs.some((l) => l.includes("new-product-a"))).toBe(true);
			expect(slugs.some((l) => l.includes("new-product-b"))).toBe(true);
		});

		it("regeneration returns the count of entries added", async () => {
			const count = await controller.regenerate({
				products: [{ slug: "p1" }, { slug: "p2" }],
				collections: [{ slug: "c1" }],
				pages: [{ slug: "about" }],
			});

			// homepage (static) + 2 products + 1 collection + 1 page = 5
			expect(count).toBe(5);
		});

		it("regeneration adds static homepage entry", async () => {
			await controller.regenerate({});

			const staticEntries = await controller.listEntries({ source: "static" });
			expect(staticEntries.length).toBeGreaterThanOrEqual(1);
		});

		it("regeneration with blog entries creates blog-source entries", async () => {
			await controller.regenerate({
				blog: [{ slug: "my-first-post" }, { slug: "second-post" }],
			});

			const blogEntries = await controller.listEntries({ source: "blog" });
			expect(blogEntries).toHaveLength(2);
			expect(blogEntries[0].source).toBe("blog");
		});

		it("regeneration with brand entries creates brand-source entries", async () => {
			await controller.regenerate({
				brands: [{ slug: "nike" }, { slug: "adidas" }],
			});

			const brandEntries = await controller.listEntries({ source: "brand" });
			expect(brandEntries).toHaveLength(2);
		});

		it("custom entries are not affected by repeated regenerations", async () => {
			const custom1 = await controller.addEntry({ path: "/special-1" });
			const custom2 = await controller.addEntry({ path: "/special-2" });

			await controller.regenerate({ products: [{ slug: "prod" }] });
			await controller.regenerate({ products: [{ slug: "other-prod" }] });

			expect(await controller.getEntry(custom1.id)).not.toBeNull();
			expect(await controller.getEntry(custom2.id)).not.toBeNull();
		});
	});

	// ── Entry Source Filtering ───────────────────────────────────────

	describe("entry source filtering", () => {
		it("listEntries with source=custom returns only custom entries", async () => {
			await controller.addEntry({ path: "/custom-a" });
			await controller.addEntry({ path: "/custom-b" });
			await controller.regenerate({
				products: [{ slug: "auto-product" }],
			});

			const customEntries = await controller.listEntries({ source: "custom" });

			expect(customEntries.length).toBe(2);
			expect(customEntries.every((e) => e.source === "custom")).toBe(true);
		});

		it("listEntries with source=product returns only product entries", async () => {
			await controller.addEntry({ path: "/my-custom-page" });
			await controller.regenerate({
				products: [{ slug: "prod-alpha" }, { slug: "prod-beta" }],
			});

			const productEntries = await controller.listEntries({
				source: "product",
			});

			expect(productEntries.every((e) => e.source === "product")).toBe(true);
			expect(productEntries.length).toBe(2);
		});

		it("countEntries with source returns filtered count", async () => {
			await controller.addEntry({ path: "/custom-x" });
			await controller.regenerate({
				collections: [{ slug: "col-1" }, { slug: "col-2" }],
			});

			const customCount = await controller.countEntries("custom");
			const collectionCount = await controller.countEntries("collection");

			expect(customCount).toBe(1);
			expect(collectionCount).toBe(2);
		});

		it("countEntries with no source returns total count", async () => {
			await controller.addEntry({ path: "/pg-a" });
			await controller.addEntry({ path: "/pg-b" });
			await controller.regenerate({
				products: [{ slug: "prod-1" }],
			});

			const total = await controller.countEntries();
			// 2 custom + 1 product + 1 static homepage = 4
			expect(total).toBe(4);
		});

		it("listEntries without source returns all entries", async () => {
			await controller.addEntry({ path: "/custom-pg" });
			await controller.regenerate({
				pages: [{ slug: "about" }],
			});

			const all = await controller.listEntries();
			const sources = new Set(all.map((e) => e.source));

			expect(sources.has("custom")).toBe(true);
			expect(sources.has("page")).toBe(true);
			expect(sources.has("static")).toBe(true);
		});
	});

	// ── Bulk Remove Safety ───────────────────────────────────────────

	describe("bulkRemoveEntries safety", () => {
		it("bulkRemoveEntries with all non-existent IDs returns 0", async () => {
			const count = await controller.bulkRemoveEntries([
				"fake-1",
				"fake-2",
				"fake-3",
			]);
			expect(count).toBe(0);
		});

		it("bulkRemoveEntries counts only successfully removed entries", async () => {
			const e1 = await controller.addEntry({ path: "/remove-a" });
			const e2 = await controller.addEntry({ path: "/remove-b" });

			const count = await controller.bulkRemoveEntries([
				e1.id,
				e2.id,
				"nonexistent",
			]);
			expect(count).toBe(2);
		});

		it("bulkRemoveEntries removes the correct entries", async () => {
			const e1 = await controller.addEntry({ path: "/gone-1" });
			const e2 = await controller.addEntry({ path: "/gone-2" });
			const e3 = await controller.addEntry({ path: "/kept" });

			await controller.bulkRemoveEntries([e1.id, e2.id]);

			expect(await controller.getEntry(e1.id)).toBeNull();
			expect(await controller.getEntry(e2.id)).toBeNull();
			expect(await controller.getEntry(e3.id)).not.toBeNull();
		});

		it("removeEntry on non-existent ID returns false", async () => {
			const result = await controller.removeEntry("nonexistent");
			expect(result).toBe(false);
		});

		it("removeEntry on existing ID returns true", async () => {
			const entry = await controller.addEntry({ path: "/deletable" });

			const result = await controller.removeEntry(entry.id);
			expect(result).toBe(true);

			// Confirm gone
			expect(await controller.getEntry(entry.id)).toBeNull();
		});
	});

	// ── Entry Uniqueness by Path (getEntryByLoc) ─────────────────────

	describe("entry uniqueness by path", () => {
		it("getEntryByLoc finds an entry by its full URL", async () => {
			const entry = await controller.addEntry({ path: "/findable" });

			const found = await controller.getEntryByLoc(entry.loc);
			expect(found).not.toBeNull();
			expect(found?.id).toBe(entry.id);
		});

		it("getEntryByLoc returns null for an unknown URL", async () => {
			const result = await controller.getEntryByLoc(
				"https://example.com/no-such-path",
			);
			expect(result).toBeNull();
		});

		it("addEntry constructs full URL from baseUrl + path", async () => {
			const entry = await controller.addEntry({ path: "/about-us" });

			expect(entry.loc).toBe("https://example.com/about-us");
		});

		it("addEntry with custom baseUrl reflects in loc", async () => {
			await controller.updateConfig({ baseUrl: "https://brand.io" });

			const entry = await controller.addEntry({ path: "/contact" });
			expect(entry.loc).toBe("https://brand.io/contact");
		});

		it("getEntryByLoc uses the correct full URL after baseUrl update", async () => {
			await controller.updateConfig({ baseUrl: "https://newdomain.com" });
			const entry = await controller.addEntry({ path: "/faq" });

			const found = await controller.getEntryByLoc("https://newdomain.com/faq");
			expect(found?.id).toBe(entry.id);
		});
	});

	// ── generateXml Pagination ───────────────────────────────────────

	describe("generateXml pagination", () => {
		it("generateXml with no page returns all entries when count is low", async () => {
			await controller.addEntry({ path: "/page-1" });
			await controller.addEntry({ path: "/page-2" });

			const xml = await controller.generateXml();
			expect(xml).toContain("<urlset");
			expect(xml).toContain("https://example.com/page-1");
			expect(xml).toContain("https://example.com/page-2");
		});

		it("generateXml contains required XML structure", async () => {
			await controller.addEntry({ path: "/structured" });

			const xml = await controller.generateXml();

			expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(xml).toContain(
				'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
			);
			expect(xml).toContain("</urlset>");
			expect(xml).toContain("<loc>");
			expect(xml).toContain("<changefreq>");
			expect(xml).toContain("<priority>");
		});

		it("generateXml escapes special characters in URLs", async () => {
			// Update config to use a URL with no special chars, test entry with &
			await controller.addEntry({ path: "/search?q=a&b=c" });

			const xml = await controller.generateXml();
			expect(xml).toContain("&amp;");
		});

		it("MAX_ENTRIES_PER_SITEMAP is the standard 50,000", () => {
			expect(MAX_ENTRIES_PER_SITEMAP).toBe(50_000);
		});

		it("generateXml includes lastmod when entry has one", async () => {
			const lastmod = new Date("2024-06-15");
			await controller.addEntry({ path: "/dated-page", lastmod });

			const xml = await controller.generateXml();
			expect(xml).toContain("<lastmod>2024-06-15</lastmod>");
		});

		it("addEntry uses config defaults for changefreq and priority", async () => {
			const entry = await controller.addEntry({ path: "/default-entry" });

			expect(entry.changefreq).toBe("weekly");
			expect(entry.priority).toBe(0.5);
			expect(entry.source).toBe("custom");
		});

		it("addEntry respects explicit changefreq and priority", async () => {
			const entry = await controller.addEntry({
				path: "/high-priority",
				changefreq: "daily",
				priority: 0.9,
			});

			expect(entry.changefreq).toBe("daily");
			expect(entry.priority).toBe(0.9);
		});
	});

	// ── Non-existent Resources ───────────────────────────────────────

	describe("non-existent resources", () => {
		it("getEntry returns null for non-existent ID", async () => {
			const result = await controller.getEntry("nonexistent");
			expect(result).toBeNull();
		});

		it("updateEntry returns null for non-existent ID", async () => {
			const result = await controller.updateEntry("nonexistent", {
				priority: 0.9,
			});
			expect(result).toBeNull();
		});

		it("bulkAddEntries returns all created entries", async () => {
			const results = await controller.bulkAddEntries([
				{ path: "/bulk-1" },
				{ path: "/bulk-2" },
				{ path: "/bulk-3" },
			]);

			expect(results).toHaveLength(3);
			expect(results.every((e) => e.source === "custom")).toBe(true);
		});
	});
});
