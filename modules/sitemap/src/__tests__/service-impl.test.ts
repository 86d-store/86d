import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_ENTRIES_PER_SITEMAP } from "../service";
import { createSitemapController } from "../service-impl";

describe("createSitemapController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSitemapController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSitemapController(mockData);
	});

	// ── getConfig ──

	describe("getConfig", () => {
		it("returns default config on first access", async () => {
			const config = await controller.getConfig();
			expect(config.id).toBe("default");
			expect(config.baseUrl).toBe("https://example.com");
			expect(config.includeProducts).toBe(true);
			expect(config.includeCollections).toBe(true);
			expect(config.includePages).toBe(true);
			expect(config.includeBlog).toBe(true);
			expect(config.includeBrands).toBe(true);
			expect(config.defaultChangeFreq).toBe("weekly");
			expect(config.defaultPriority).toBe(0.5);
			expect(config.productChangeFreq).toBe("weekly");
			expect(config.productPriority).toBe(0.8);
			expect(config.collectionChangeFreq).toBe("weekly");
			expect(config.collectionPriority).toBe(0.7);
			expect(config.pageChangeFreq).toBe("monthly");
			expect(config.pagePriority).toBe(0.6);
			expect(config.blogChangeFreq).toBe("weekly");
			expect(config.blogPriority).toBe(0.6);
			expect(config.createdAt).toBeInstanceOf(Date);
			expect(config.updatedAt).toBeInstanceOf(Date);
		});

		it("returns same config on subsequent calls", async () => {
			const first = await controller.getConfig();
			const second = await controller.getConfig();
			expect(first.id).toBe(second.id);
			expect(first.baseUrl).toBe(second.baseUrl);
		});

		it("persists default config to data service", async () => {
			await controller.getConfig();
			// Verify it was persisted by fetching again
			const config = await controller.getConfig();
			expect(config.baseUrl).toBe("https://example.com");
		});

		it("does not have excludedPaths in default config", async () => {
			const config = await controller.getConfig();
			expect(config.excludedPaths).toBeUndefined();
		});

		it("does not have lastGenerated in default config", async () => {
			const config = await controller.getConfig();
			expect(config.lastGenerated).toBeUndefined();
		});
	});

	// ── updateConfig ──

	describe("updateConfig", () => {
		it("updates baseUrl", async () => {
			const updated = await controller.updateConfig({
				baseUrl: "https://mystore.com",
			});
			expect(updated.baseUrl).toBe("https://mystore.com");
		});

		it("preserves unchanged fields", async () => {
			await controller.updateConfig({
				baseUrl: "https://mystore.com",
			});
			const config = await controller.getConfig();
			expect(config.includeProducts).toBe(true);
			expect(config.productPriority).toBe(0.8);
			expect(config.includeCollections).toBe(true);
		});

		it("updates toggle fields", async () => {
			const updated = await controller.updateConfig({
				includeProducts: false,
				includeBlog: false,
			});
			expect(updated.includeProducts).toBe(false);
			expect(updated.includeBlog).toBe(false);
			expect(updated.includeCollections).toBe(true);
		});

		it("updates priority and changefreq", async () => {
			const updated = await controller.updateConfig({
				productPriority: 0.9,
				productChangeFreq: "daily",
			});
			expect(updated.productPriority).toBe(0.9);
			expect(updated.productChangeFreq).toBe("daily");
		});

		it("updates excludedPaths", async () => {
			const updated = await controller.updateConfig({
				excludedPaths: ["/admin", "/private"],
			});
			expect(updated.excludedPaths).toEqual(["/admin", "/private"]);
		});

		it("updates updatedAt timestamp", async () => {
			const original = await controller.getConfig();
			const updated = await controller.updateConfig({
				baseUrl: "https://new.com",
			});
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				original.updatedAt.getTime(),
			);
		});

		it("preserves createdAt on update", async () => {
			const original = await controller.getConfig();
			const updated = await controller.updateConfig({
				baseUrl: "https://new.com",
			});
			expect(updated.createdAt.getTime()).toBe(original.createdAt.getTime());
		});

		it("always keeps id as 'default'", async () => {
			const updated = await controller.updateConfig({
				baseUrl: "https://new.com",
			});
			expect(updated.id).toBe("default");
		});

		it("updates all toggles at once", async () => {
			const updated = await controller.updateConfig({
				includeProducts: false,
				includeCollections: false,
				includePages: false,
				includeBlog: false,
				includeBrands: false,
			});
			expect(updated.includeProducts).toBe(false);
			expect(updated.includeCollections).toBe(false);
			expect(updated.includePages).toBe(false);
			expect(updated.includeBlog).toBe(false);
			expect(updated.includeBrands).toBe(false);
		});

		it("updates collection-specific settings", async () => {
			const updated = await controller.updateConfig({
				collectionChangeFreq: "daily",
				collectionPriority: 0.9,
			});
			expect(updated.collectionChangeFreq).toBe("daily");
			expect(updated.collectionPriority).toBe(0.9);
		});

		it("updates page-specific settings", async () => {
			const updated = await controller.updateConfig({
				pageChangeFreq: "yearly",
				pagePriority: 0.3,
			});
			expect(updated.pageChangeFreq).toBe("yearly");
			expect(updated.pagePriority).toBe(0.3);
		});

		it("updates blog-specific settings", async () => {
			const updated = await controller.updateConfig({
				blogChangeFreq: "daily",
				blogPriority: 0.9,
			});
			expect(updated.blogChangeFreq).toBe("daily");
			expect(updated.blogPriority).toBe(0.9);
		});

		it("no-op update preserves existing values", async () => {
			const original = await controller.getConfig();
			const updated = await controller.updateConfig({});
			expect(updated.baseUrl).toBe(original.baseUrl);
			expect(updated.includeProducts).toBe(original.includeProducts);
		});
	});

	// ── addEntry ──

	describe("addEntry", () => {
		it("adds a custom entry with path", async () => {
			const entry = await controller.addEntry({ path: "/custom-page" });
			expect(entry.id).toBeDefined();
			expect(entry.loc).toBe("https://example.com/custom-page");
			expect(entry.source).toBe("custom");
			expect(entry.changefreq).toBe("weekly");
			expect(entry.priority).toBe(0.5);
			expect(entry.createdAt).toBeInstanceOf(Date);
		});

		it("uses custom changefreq and priority", async () => {
			const entry = await controller.addEntry({
				path: "/important",
				changefreq: "daily",
				priority: 0.9,
			});
			expect(entry.changefreq).toBe("daily");
			expect(entry.priority).toBe(0.9);
		});

		it("includes lastmod when provided", async () => {
			const date = new Date("2024-01-15");
			const entry = await controller.addEntry({
				path: "/dated",
				lastmod: date,
			});
			expect(entry.lastmod).toEqual(date);
		});

		it("omits lastmod when not provided", async () => {
			const entry = await controller.addEntry({ path: "/page" });
			expect(entry.lastmod).toBeUndefined();
		});

		it("uses baseUrl from config", async () => {
			await controller.updateConfig({
				baseUrl: "https://mystore.com",
			});
			const entry = await controller.addEntry({ path: "/page" });
			expect(entry.loc).toBe("https://mystore.com/page");
		});

		it("strips trailing slash from baseUrl", async () => {
			await controller.updateConfig({
				baseUrl: "https://mystore.com/",
			});
			const entry = await controller.addEntry({ path: "/page" });
			expect(entry.loc).toBe("https://mystore.com/page");
		});

		it("generates unique IDs for each entry", async () => {
			const a = await controller.addEntry({ path: "/a" });
			const b = await controller.addEntry({ path: "/b" });
			expect(a.id).not.toBe(b.id);
		});

		it("uses config default changefreq when not specified", async () => {
			await controller.updateConfig({ defaultChangeFreq: "daily" });
			const entry = await controller.addEntry({ path: "/test" });
			expect(entry.changefreq).toBe("daily");
		});

		it("uses config default priority when not specified", async () => {
			await controller.updateConfig({ defaultPriority: 0.9 });
			const entry = await controller.addEntry({ path: "/test" });
			expect(entry.priority).toBe(0.9);
		});
	});

	// ── getEntry ──

	describe("getEntry", () => {
		it("returns entry by ID", async () => {
			const created = await controller.addEntry({ path: "/test" });
			const found = await controller.getEntry(created.id);
			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
			expect(found?.loc).toBe(created.loc);
		});

		it("returns null for non-existent ID", async () => {
			const found = await controller.getEntry("non-existent-id");
			expect(found).toBeNull();
		});

		it("returns full entry data", async () => {
			const date = new Date("2024-06-15");
			const created = await controller.addEntry({
				path: "/full",
				changefreq: "daily",
				priority: 0.9,
				lastmod: date,
			});
			const found = await controller.getEntry(created.id);
			expect(found?.changefreq).toBe("daily");
			expect(found?.priority).toBe(0.9);
			expect(found?.lastmod).toEqual(date);
			expect(found?.source).toBe("custom");
		});
	});

	// ── getEntryByLoc ──

	describe("getEntryByLoc", () => {
		it("finds entry by full URL", async () => {
			await controller.addEntry({ path: "/about" });
			const found = await controller.getEntryByLoc("https://example.com/about");
			expect(found).not.toBeNull();
			expect(found?.loc).toBe("https://example.com/about");
		});

		it("returns null when no match", async () => {
			const found = await controller.getEntryByLoc(
				"https://example.com/not-found",
			);
			expect(found).toBeNull();
		});

		it("finds auto-generated entries by loc", async () => {
			await controller.regenerate({
				products: [{ slug: "shoe" }],
			});
			const found = await controller.getEntryByLoc(
				"https://example.com/products/shoe",
			);
			expect(found).not.toBeNull();
			expect(found?.source).toBe("product");
		});
	});

	// ── updateEntry ──

	describe("updateEntry", () => {
		it("updates entry path", async () => {
			const entry = await controller.addEntry({ path: "/old" });
			const updated = await controller.updateEntry(entry.id, {
				path: "/new",
			});
			expect(updated).not.toBeNull();
			expect(updated?.loc).toBe("https://example.com/new");
		});

		it("updates changefreq", async () => {
			const entry = await controller.addEntry({ path: "/test" });
			const updated = await controller.updateEntry(entry.id, {
				changefreq: "daily",
			});
			expect(updated?.changefreq).toBe("daily");
		});

		it("updates priority", async () => {
			const entry = await controller.addEntry({ path: "/test" });
			const updated = await controller.updateEntry(entry.id, {
				priority: 0.9,
			});
			expect(updated?.priority).toBe(0.9);
		});

		it("updates lastmod", async () => {
			const entry = await controller.addEntry({ path: "/test" });
			const date = new Date("2025-01-01");
			const updated = await controller.updateEntry(entry.id, {
				lastmod: date,
			});
			expect(updated?.lastmod).toEqual(date);
		});

		it("returns null for non-existent entry", async () => {
			const updated = await controller.updateEntry("fake-id", {
				path: "/new",
			});
			expect(updated).toBeNull();
		});

		it("preserves unchanged fields", async () => {
			const entry = await controller.addEntry({
				path: "/test",
				changefreq: "daily",
				priority: 0.9,
			});
			const updated = await controller.updateEntry(entry.id, {
				path: "/updated",
			});
			expect(updated?.changefreq).toBe("daily");
			expect(updated?.priority).toBe(0.9);
		});

		it("uses current config baseUrl for path updates", async () => {
			const entry = await controller.addEntry({ path: "/test" });
			await controller.updateConfig({ baseUrl: "https://newstore.com" });
			const updated = await controller.updateEntry(entry.id, {
				path: "/updated",
			});
			expect(updated?.loc).toBe("https://newstore.com/updated");
		});

		it("updates multiple fields at once", async () => {
			const entry = await controller.addEntry({ path: "/test" });
			const updated = await controller.updateEntry(entry.id, {
				path: "/new",
				changefreq: "hourly",
				priority: 1.0,
				lastmod: new Date("2025-06-01"),
			});
			expect(updated?.loc).toBe("https://example.com/new");
			expect(updated?.changefreq).toBe("hourly");
			expect(updated?.priority).toBe(1.0);
		});
	});

	// ── removeEntry ──

	describe("removeEntry", () => {
		it("removes an entry", async () => {
			const entry = await controller.addEntry({ path: "/remove-me" });
			const removed = await controller.removeEntry(entry.id);
			expect(removed).toBe(true);
			const count = await controller.countEntries();
			expect(count).toBe(0);
		});

		it("returns false for non-existent id", async () => {
			const removed = await controller.removeEntry("non-existent");
			expect(removed).toBe(false);
		});

		it("does not affect other entries", async () => {
			const a = await controller.addEntry({ path: "/a" });
			await controller.addEntry({ path: "/b" });
			await controller.removeEntry(a.id);
			const entries = await controller.listEntries();
			expect(entries).toHaveLength(1);
			expect(entries[0].loc).toContain("/b");
		});
	});

	// ── bulkAddEntries ──

	describe("bulkAddEntries", () => {
		it("adds multiple entries at once", async () => {
			const entries = await controller.bulkAddEntries([
				{ path: "/a" },
				{ path: "/b" },
				{ path: "/c" },
			]);
			expect(entries).toHaveLength(3);
			expect(entries[0].loc).toContain("/a");
			expect(entries[1].loc).toContain("/b");
			expect(entries[2].loc).toContain("/c");
		});

		it("applies custom options to each entry", async () => {
			const entries = await controller.bulkAddEntries([
				{ path: "/fast", changefreq: "hourly", priority: 1.0 },
				{ path: "/slow", changefreq: "yearly", priority: 0.1 },
			]);
			expect(entries[0].changefreq).toBe("hourly");
			expect(entries[0].priority).toBe(1.0);
			expect(entries[1].changefreq).toBe("yearly");
			expect(entries[1].priority).toBe(0.1);
		});

		it("returns empty array for empty input", async () => {
			const entries = await controller.bulkAddEntries([]);
			expect(entries).toHaveLength(0);
		});

		it("assigns unique IDs to each entry", async () => {
			const entries = await controller.bulkAddEntries([
				{ path: "/a" },
				{ path: "/b" },
			]);
			expect(entries[0].id).not.toBe(entries[1].id);
		});

		it("all entries are source 'custom'", async () => {
			const entries = await controller.bulkAddEntries([
				{ path: "/x" },
				{ path: "/y" },
			]);
			for (const entry of entries) {
				expect(entry.source).toBe("custom");
			}
		});
	});

	// ── bulkRemoveEntries ──

	describe("bulkRemoveEntries", () => {
		it("removes multiple entries", async () => {
			const a = await controller.addEntry({ path: "/a" });
			const b = await controller.addEntry({ path: "/b" });
			await controller.addEntry({ path: "/c" });
			const removed = await controller.bulkRemoveEntries([a.id, b.id]);
			expect(removed).toBe(2);
			const count = await controller.countEntries();
			expect(count).toBe(1);
		});

		it("returns 0 for empty input", async () => {
			const removed = await controller.bulkRemoveEntries([]);
			expect(removed).toBe(0);
		});

		it("skips non-existent IDs", async () => {
			const a = await controller.addEntry({ path: "/a" });
			const removed = await controller.bulkRemoveEntries([
				a.id,
				"fake-id-1",
				"fake-id-2",
			]);
			expect(removed).toBe(1);
		});

		it("returns count of actually removed entries", async () => {
			const removed = await controller.bulkRemoveEntries(["fake-1", "fake-2"]);
			expect(removed).toBe(0);
		});
	});

	// ── listEntries ──

	describe("listEntries", () => {
		it("lists all entries", async () => {
			await controller.addEntry({ path: "/a" });
			await controller.addEntry({ path: "/b" });
			const entries = await controller.listEntries();
			expect(entries).toHaveLength(2);
		});

		it("filters by source", async () => {
			await controller.addEntry({ path: "/custom" });
			await controller.regenerate({
				products: [{ slug: "shoe" }],
			});
			const custom = await controller.listEntries({ source: "custom" });
			expect(custom).toHaveLength(1);
			expect(custom[0].source).toBe("custom");
		});

		it("supports pagination with take", async () => {
			await controller.addEntry({ path: "/a" });
			await controller.addEntry({ path: "/b" });
			await controller.addEntry({ path: "/c" });
			const page = await controller.listEntries({ take: 2 });
			expect(page).toHaveLength(2);
		});

		it("supports pagination with skip", async () => {
			await controller.addEntry({ path: "/a" });
			await controller.addEntry({ path: "/b" });
			await controller.addEntry({ path: "/c" });
			const page = await controller.listEntries({ skip: 1, take: 10 });
			expect(page.length).toBeLessThanOrEqual(2);
		});

		it("returns empty array when no entries exist", async () => {
			const entries = await controller.listEntries();
			expect(entries).toHaveLength(0);
		});

		it("filters static entries", async () => {
			await controller.regenerate({});
			const staticEntries = await controller.listEntries({
				source: "static",
			});
			expect(staticEntries).toHaveLength(1);
			expect(staticEntries[0].source).toBe("static");
		});

		it("returns entries from both sources", async () => {
			await controller.addEntry({ path: "/zebra" });
			await controller.addEntry({ path: "/alpha" });
			const entries = await controller.listEntries();
			const locs = entries.map((e) => e.loc);
			expect(locs.some((l) => l.includes("/alpha"))).toBe(true);
			expect(locs.some((l) => l.includes("/zebra"))).toBe(true);
		});
	});

	// ── countEntries ──

	describe("countEntries", () => {
		it("counts all entries", async () => {
			await controller.addEntry({ path: "/a" });
			await controller.addEntry({ path: "/b" });
			expect(await controller.countEntries()).toBe(2);
		});

		it("counts by source", async () => {
			await controller.addEntry({ path: "/custom" });
			await controller.regenerate({
				products: [{ slug: "shoe" }],
			});
			expect(await controller.countEntries("custom")).toBe(1);
			expect(await controller.countEntries("product")).toBe(1);
			expect(await controller.countEntries("static")).toBe(1);
		});

		it("returns 0 when no entries exist", async () => {
			expect(await controller.countEntries()).toBe(0);
		});

		it("returns 0 for non-existent source", async () => {
			await controller.addEntry({ path: "/a" });
			expect(await controller.countEntries("nonexistent")).toBe(0);
		});
	});

	// ── generateXml ──

	describe("generateXml", () => {
		it("generates valid XML with no entries", async () => {
			const xml = await controller.generateXml();
			expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(xml).toContain("<urlset");
			expect(xml).toContain("</urlset>");
			expect(xml).not.toContain("<url>");
		});

		it("generates XML with entries", async () => {
			await controller.addEntry({ path: "/about" });
			const xml = await controller.generateXml();
			expect(xml).toContain("<url>");
			expect(xml).toContain("<loc>https://example.com/about</loc>");
			expect(xml).toContain("<changefreq>weekly</changefreq>");
			expect(xml).toContain("<priority>0.5</priority>");
		});

		it("includes lastmod when present", async () => {
			await controller.addEntry({
				path: "/dated",
				lastmod: new Date("2024-06-15"),
			});
			const xml = await controller.generateXml();
			expect(xml).toContain("<lastmod>2024-06-15</lastmod>");
		});

		it("omits lastmod when not present", async () => {
			await controller.addEntry({ path: "/no-date" });
			const xml = await controller.generateXml();
			expect(xml).not.toContain("<lastmod>");
		});

		it("escapes XML special characters in URLs", async () => {
			await controller.addEntry({ path: "/search?q=foo&bar=baz" });
			const xml = await controller.generateXml();
			expect(xml).toContain("&amp;");
			expect(xml).not.toContain("&bar");
		});

		it("escapes angle brackets in URLs", async () => {
			await controller.addEntry({ path: "/test<script>" });
			const xml = await controller.generateXml();
			expect(xml).toContain("&lt;script&gt;");
		});

		it("escapes quotes in URLs", async () => {
			await controller.addEntry({ path: '/test"quoted"' });
			const xml = await controller.generateXml();
			expect(xml).toContain("&quot;");
		});

		it("formats priority with one decimal place", async () => {
			await controller.addEntry({ path: "/test", priority: 0.8 });
			const xml = await controller.generateXml();
			expect(xml).toContain("<priority>0.8</priority>");
		});

		it("formats priority 1.0 correctly", async () => {
			await controller.addEntry({ path: "/test", priority: 1.0 });
			const xml = await controller.generateXml();
			expect(xml).toContain("<priority>1.0</priority>");
		});

		it("formats priority 0.0 correctly", async () => {
			await controller.addEntry({ path: "/test", priority: 0.0 });
			const xml = await controller.generateXml();
			expect(xml).toContain("<priority>0.0</priority>");
		});

		it("generates XML with multiple entries", async () => {
			await controller.addEntry({ path: "/z" });
			await controller.addEntry({ path: "/a" });
			const xml = await controller.generateXml();
			expect(xml).toContain("/a</loc>");
			expect(xml).toContain("/z</loc>");
			// Both entries appear as <url> blocks
			const urlCount = (xml.match(/<url>/g) ?? []).length;
			expect(urlCount).toBe(2);
		});

		it("includes sitemaps.org namespace", async () => {
			const xml = await controller.generateXml();
			expect(xml).toContain(
				'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
			);
		});

		it("supports page parameter for paginated sitemaps", async () => {
			await controller.addEntry({ path: "/a" });
			await controller.addEntry({ path: "/b" });
			const xml = await controller.generateXml(0);
			expect(xml).toContain("/a</loc>");
			expect(xml).toContain("/b</loc>");
		});
	});

	// ── generateSitemapIndex ──

	describe("generateSitemapIndex", () => {
		it("returns null when entries fit in one sitemap", async () => {
			await controller.addEntry({ path: "/a" });
			const result = await controller.generateSitemapIndex();
			expect(result).toBeNull();
		});

		it("returns null when no entries exist", async () => {
			const result = await controller.generateSitemapIndex();
			expect(result).toBeNull();
		});

		it("MAX_ENTRIES_PER_SITEMAP is 50000", () => {
			expect(MAX_ENTRIES_PER_SITEMAP).toBe(50_000);
		});
	});

	// ── regenerate ──

	describe("regenerate", () => {
		it("generates homepage entry", async () => {
			const count = await controller.regenerate({});
			expect(count).toBe(1);
			const entries = await controller.listEntries();
			expect(entries).toHaveLength(1);
			expect(entries[0].loc).toBe("https://example.com");
			expect(entries[0].source).toBe("static");
			expect(entries[0].priority).toBe(1.0);
		});

		it("generates product entries", async () => {
			const count = await controller.regenerate({
				products: [
					{ slug: "red-shoes", updatedAt: new Date("2024-01-01") },
					{ slug: "blue-hat" },
				],
			});
			expect(count).toBe(3); // homepage + 2 products
			const products = await controller.listEntries({
				source: "product",
			});
			expect(products).toHaveLength(2);
			expect(products[0].loc).toContain("/products/");
		});

		it("generates collection entries", async () => {
			await controller.regenerate({
				collections: [{ slug: "summer" }, { slug: "winter" }],
			});
			const collections = await controller.listEntries({
				source: "collection",
			});
			expect(collections).toHaveLength(2);
			expect(collections[0].loc).toContain("/collections/");
		});

		it("generates page entries", async () => {
			await controller.regenerate({
				pages: [{ slug: "about" }, { slug: "contact" }],
			});
			const pages = await controller.listEntries({ source: "page" });
			expect(pages).toHaveLength(2);
		});

		it("generates blog entries", async () => {
			await controller.regenerate({
				blog: [{ slug: "hello-world" }],
			});
			const blog = await controller.listEntries({ source: "blog" });
			expect(blog).toHaveLength(1);
			expect(blog[0].loc).toContain("/blog/hello-world");
		});

		it("generates brand entries", async () => {
			await controller.regenerate({
				brands: [{ slug: "nike" }],
			});
			const brands = await controller.listEntries({ source: "brand" });
			expect(brands).toHaveLength(1);
			expect(brands[0].loc).toContain("/brands/nike");
		});

		it("respects includeProducts toggle", async () => {
			await controller.updateConfig({ includeProducts: false });
			await controller.regenerate({
				products: [{ slug: "shoe" }],
			});
			expect(await controller.listEntries({ source: "product" })).toHaveLength(
				0,
			);
		});

		it("respects includeCollections toggle", async () => {
			await controller.updateConfig({ includeCollections: false });
			await controller.regenerate({
				collections: [{ slug: "summer" }],
			});
			expect(
				await controller.listEntries({ source: "collection" }),
			).toHaveLength(0);
		});

		it("respects includePages toggle", async () => {
			await controller.updateConfig({ includePages: false });
			await controller.regenerate({
				pages: [{ slug: "about" }],
			});
			expect(await controller.listEntries({ source: "page" })).toHaveLength(0);
		});

		it("respects includeBlog toggle", async () => {
			await controller.updateConfig({ includeBlog: false });
			await controller.regenerate({
				blog: [{ slug: "post" }],
			});
			expect(await controller.listEntries({ source: "blog" })).toHaveLength(0);
		});

		it("respects includeBrands toggle", async () => {
			await controller.updateConfig({ includeBrands: false });
			await controller.regenerate({
				brands: [{ slug: "nike" }],
			});
			expect(await controller.listEntries({ source: "brand" })).toHaveLength(0);
		});

		it("uses configured priorities", async () => {
			await controller.updateConfig({ productPriority: 0.9 });
			await controller.regenerate({
				products: [{ slug: "shoe" }],
			});
			const products = await controller.listEntries({
				source: "product",
			});
			expect(products[0].priority).toBe(0.9);
		});

		it("uses configured changefreq for products", async () => {
			await controller.updateConfig({ productChangeFreq: "daily" });
			await controller.regenerate({
				products: [{ slug: "shoe" }],
			});
			const products = await controller.listEntries({
				source: "product",
			});
			expect(products[0].changefreq).toBe("daily");
		});

		it("uses configured changefreq for collections", async () => {
			await controller.updateConfig({ collectionChangeFreq: "monthly" });
			await controller.regenerate({
				collections: [{ slug: "sale" }],
			});
			const collections = await controller.listEntries({
				source: "collection",
			});
			expect(collections[0].changefreq).toBe("monthly");
		});

		it("uses configured changefreq for pages", async () => {
			await controller.updateConfig({ pageChangeFreq: "yearly" });
			await controller.regenerate({
				pages: [{ slug: "about" }],
			});
			const pages = await controller.listEntries({ source: "page" });
			expect(pages[0].changefreq).toBe("yearly");
		});

		it("excludes paths in excludedPaths", async () => {
			await controller.updateConfig({
				excludedPaths: ["/products/secret"],
			});
			await controller.regenerate({
				products: [{ slug: "secret" }, { slug: "public" }],
			});
			const products = await controller.listEntries({
				source: "product",
			});
			expect(products).toHaveLength(1);
			expect(products[0].loc).toContain("/products/public");
		});

		it("excludes paths and their children", async () => {
			await controller.updateConfig({
				excludedPaths: ["/products/secret"],
			});
			await controller.regenerate({
				products: [{ slug: "secret/variant-a" }, { slug: "public" }],
			});
			const products = await controller.listEntries({
				source: "product",
			});
			expect(products).toHaveLength(1);
		});

		it("excludes homepage when / is in excludedPaths", async () => {
			await controller.updateConfig({ excludedPaths: ["/"] });
			const count = await controller.regenerate({});
			expect(count).toBe(0);
		});

		it("preserves custom entries on regenerate", async () => {
			await controller.addEntry({ path: "/custom-page" });
			await controller.regenerate({
				products: [{ slug: "shoe" }],
			});
			const custom = await controller.listEntries({ source: "custom" });
			expect(custom).toHaveLength(1);
			expect(custom[0].loc).toContain("/custom-page");
		});

		it("clears old auto-generated entries on regenerate", async () => {
			await controller.regenerate({
				products: [{ slug: "old-shoe" }],
			});
			await controller.regenerate({
				products: [{ slug: "new-shoe" }],
			});
			const products = await controller.listEntries({
				source: "product",
			});
			expect(products).toHaveLength(1);
			expect(products[0].loc).toContain("new-shoe");
		});

		it("includes lastmod from updatedAt", async () => {
			const date = new Date("2024-03-10");
			await controller.regenerate({
				products: [{ slug: "shoe", updatedAt: date }],
			});
			const products = await controller.listEntries({
				source: "product",
			});
			expect(products[0].lastmod).toEqual(date);
		});

		it("omits lastmod when updatedAt not provided", async () => {
			await controller.regenerate({
				products: [{ slug: "shoe" }],
			});
			const products = await controller.listEntries({
				source: "product",
			});
			expect(products[0].lastmod).toBeUndefined();
		});

		it("uses baseUrl from config", async () => {
			await controller.updateConfig({
				baseUrl: "https://mystore.com",
			});
			await controller.regenerate({
				products: [{ slug: "shoe" }],
			});
			const products = await controller.listEntries({
				source: "product",
			});
			expect(products[0].loc.startsWith("https://mystore.com")).toBe(true);
		});

		it("sets sourceId on product entries", async () => {
			await controller.regenerate({
				products: [{ slug: "shoe" }],
			});
			const products = await controller.listEntries({
				source: "product",
			});
			expect(products[0].sourceId).toBe("shoe");
		});

		it("sets sourceId on collection entries", async () => {
			await controller.regenerate({
				collections: [{ slug: "summer" }],
			});
			const collections = await controller.listEntries({
				source: "collection",
			});
			expect(collections[0].sourceId).toBe("summer");
		});

		it("sets sourceId on page entries", async () => {
			await controller.regenerate({
				pages: [{ slug: "about" }],
			});
			const pages = await controller.listEntries({ source: "page" });
			expect(pages[0].sourceId).toBe("about");
		});

		it("sets sourceId on blog entries", async () => {
			await controller.regenerate({
				blog: [{ slug: "post" }],
			});
			const blog = await controller.listEntries({ source: "blog" });
			expect(blog[0].sourceId).toBe("post");
		});

		it("sets sourceId on brand entries", async () => {
			await controller.regenerate({
				brands: [{ slug: "nike" }],
			});
			const brands = await controller.listEntries({ source: "brand" });
			expect(brands[0].sourceId).toBe("nike");
		});

		it("handles all sources together", async () => {
			const count = await controller.regenerate({
				products: [{ slug: "shoe" }],
				collections: [{ slug: "summer" }],
				pages: [{ slug: "about" }],
				blog: [{ slug: "post" }],
				brands: [{ slug: "nike" }],
			});
			expect(count).toBe(6); // homepage + 5
		});

		it("handles all toggles off", async () => {
			await controller.updateConfig({
				includeProducts: false,
				includeCollections: false,
				includePages: false,
				includeBlog: false,
				includeBrands: false,
			});
			const count = await controller.regenerate({
				products: [{ slug: "shoe" }],
				collections: [{ slug: "summer" }],
				pages: [{ slug: "about" }],
				blog: [{ slug: "post" }],
				brands: [{ slug: "nike" }],
			});
			expect(count).toBe(1); // homepage only
		});

		it("updates lastGenerated on regenerate", async () => {
			await controller.regenerate({});
			const config = await controller.getConfig();
			expect(config.lastGenerated).toBeInstanceOf(Date);
		});

		it("page entries use /{slug} path", async () => {
			await controller.regenerate({ pages: [{ slug: "about" }] });
			const pages = await controller.listEntries({ source: "page" });
			expect(pages[0].loc).toBe("https://example.com/about");
		});

		it("blog entries use /blog/{slug} path", async () => {
			await controller.regenerate({ blog: [{ slug: "post" }] });
			const blog = await controller.listEntries({ source: "blog" });
			expect(blog[0].loc).toBe("https://example.com/blog/post");
		});

		it("brand entries use /brands/{slug} path", async () => {
			await controller.regenerate({ brands: [{ slug: "nike" }] });
			const brands = await controller.listEntries({ source: "brand" });
			expect(brands[0].loc).toBe("https://example.com/brands/nike");
		});

		it("product entries use /products/{slug} path", async () => {
			await controller.regenerate({ products: [{ slug: "shoe" }] });
			const products = await controller.listEntries({ source: "product" });
			expect(products[0].loc).toBe("https://example.com/products/shoe");
		});

		it("collection entries use /collections/{slug} path", async () => {
			await controller.regenerate({
				collections: [{ slug: "summer" }],
			});
			const collections = await controller.listEntries({
				source: "collection",
			});
			expect(collections[0].loc).toBe("https://example.com/collections/summer");
		});

		it("handles multiple products", async () => {
			await controller.regenerate({
				products: [
					{ slug: "a" },
					{ slug: "b" },
					{ slug: "c" },
					{ slug: "d" },
					{ slug: "e" },
				],
			});
			const products = await controller.listEntries({ source: "product" });
			expect(products).toHaveLength(5);
		});

		it("strips trailing slash from baseUrl in generated entries", async () => {
			await controller.updateConfig({ baseUrl: "https://mystore.com/" });
			await controller.regenerate({ products: [{ slug: "shoe" }] });
			const products = await controller.listEntries({ source: "product" });
			expect(products[0].loc).toBe("https://mystore.com/products/shoe");
		});
	});

	// ── getStats ──

	describe("getStats", () => {
		it("returns empty stats for no entries", async () => {
			const stats = await controller.getStats();
			expect(stats.totalEntries).toBe(0);
			expect(stats.entriesBySource).toEqual({});
		});

		it("counts entries by source", async () => {
			await controller.regenerate({
				products: [{ slug: "a" }, { slug: "b" }],
				pages: [{ slug: "about" }],
			});
			const stats = await controller.getStats();
			expect(stats.totalEntries).toBe(4);
			expect(stats.entriesBySource.product).toBe(2);
			expect(stats.entriesBySource.page).toBe(1);
			expect(stats.entriesBySource.static).toBe(1);
		});

		it("includes custom entries in count", async () => {
			await controller.addEntry({ path: "/custom" });
			const stats = await controller.getStats();
			expect(stats.entriesBySource.custom).toBe(1);
		});

		it("includes lastGenerated when available", async () => {
			await controller.regenerate({});
			const stats = await controller.getStats();
			expect(stats.lastGenerated).toBeInstanceOf(Date);
		});

		it("does not include lastGenerated before first regeneration", async () => {
			const stats = await controller.getStats();
			expect(stats.lastGenerated).toBeUndefined();
		});

		it("counts all source types", async () => {
			await controller.addEntry({ path: "/custom" });
			await controller.regenerate({
				products: [{ slug: "shoe" }],
				collections: [{ slug: "summer" }],
				pages: [{ slug: "about" }],
				blog: [{ slug: "post" }],
				brands: [{ slug: "nike" }],
			});
			const stats = await controller.getStats();
			expect(stats.totalEntries).toBe(7);
			expect(stats.entriesBySource.custom).toBe(1);
			expect(stats.entriesBySource.static).toBe(1);
			expect(stats.entriesBySource.product).toBe(1);
			expect(stats.entriesBySource.collection).toBe(1);
			expect(stats.entriesBySource.page).toBe(1);
			expect(stats.entriesBySource.blog).toBe(1);
			expect(stats.entriesBySource.brand).toBe(1);
		});
	});

	// ── Integration ──

	describe("integration", () => {
		it("full workflow: config → regenerate → add custom → generate XML", async () => {
			await controller.updateConfig({
				baseUrl: "https://shop.example.com",
				productPriority: 0.9,
			});

			await controller.regenerate({
				products: [{ slug: "sneakers", updatedAt: new Date("2024-06-01") }],
				pages: [{ slug: "about" }],
			});

			await controller.addEntry({
				path: "/special-offer",
				priority: 1.0,
				changefreq: "hourly",
			});

			const xml = await controller.generateXml();
			expect(xml).toContain("https://shop.example.com</loc>");
			expect(xml).toContain("https://shop.example.com/products/sneakers</loc>");
			expect(xml).toContain("https://shop.example.com/about</loc>");
			expect(xml).toContain("https://shop.example.com/special-offer</loc>");
			expect(xml).toContain("<lastmod>2024-06-01</lastmod>");

			const stats = await controller.getStats();
			expect(stats.totalEntries).toBe(4);
		});

		it("bulk add then bulk remove workflow", async () => {
			const entries = await controller.bulkAddEntries([
				{ path: "/a" },
				{ path: "/b" },
				{ path: "/c" },
				{ path: "/d" },
			]);
			expect(await controller.countEntries()).toBe(4);

			const removed = await controller.bulkRemoveEntries([
				entries[0].id,
				entries[2].id,
			]);
			expect(removed).toBe(2);
			expect(await controller.countEntries()).toBe(2);

			const remaining = await controller.listEntries();
			const locs = remaining.map((e) => e.loc);
			expect(locs.some((l) => l.includes("/b"))).toBe(true);
			expect(locs.some((l) => l.includes("/d"))).toBe(true);
		});

		it("update entry then verify in XML", async () => {
			const entry = await controller.addEntry({
				path: "/old-name",
				priority: 0.3,
			});
			await controller.updateEntry(entry.id, {
				path: "/new-name",
				priority: 0.9,
				changefreq: "hourly",
			});

			const xml = await controller.generateXml();
			expect(xml).not.toContain("/old-name");
			expect(xml).toContain("/new-name");
			expect(xml).toContain("<priority>0.9</priority>");
			expect(xml).toContain("<changefreq>hourly</changefreq>");
		});

		it("getEntryByLoc after addEntry", async () => {
			await controller.addEntry({ path: "/findme" });
			const found = await controller.getEntryByLoc(
				"https://example.com/findme",
			);
			expect(found).not.toBeNull();
			expect(found?.source).toBe("custom");
		});

		it("regenerate clears auto entries but custom stays accessible", async () => {
			const custom = await controller.addEntry({ path: "/keep-me" });
			await controller.regenerate({
				products: [{ slug: "shoe" }],
			});

			const found = await controller.getEntry(custom.id);
			expect(found).not.toBeNull();
			expect(found?.loc).toContain("/keep-me");
		});

		it("excludedPaths do not affect custom entries", async () => {
			await controller.addEntry({ path: "/products/excluded" });
			await controller.updateConfig({
				excludedPaths: ["/products/excluded"],
			});
			await controller.regenerate({
				products: [{ slug: "excluded" }, { slug: "included" }],
			});

			const custom = await controller.listEntries({ source: "custom" });
			expect(custom).toHaveLength(1);

			const products = await controller.listEntries({
				source: "product",
			});
			expect(products).toHaveLength(1);
			expect(products[0].sourceId).toBe("included");
		});
	});
});
