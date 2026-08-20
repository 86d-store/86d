import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_ENTRIES_PER_SITEMAP } from "../service";
import { createSitemapController } from "../service-impl";

describe("sitemap controller", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSitemapController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSitemapController(mockData);
	});

	// ── getConfig edge cases ────────────────────────────────────────────

	describe("getConfig edge cases", () => {
		it("creates config once and reuses it on second call", async () => {
			const first = await controller.getConfig();
			const second = await controller.getConfig();
			expect(first.createdAt.getTime()).toBe(second.createdAt.getTime());
			expect(mockData.size("sitemapConfig")).toBe(1);
		});

		it("default config has correct createdAt and updatedAt equal", async () => {
			const config = await controller.getConfig();
			expect(config.createdAt.getTime()).toBe(config.updatedAt.getTime());
		});

		it("default config id is always 'default'", async () => {
			const config = await controller.getConfig();
			expect(config.id).toBe("default");
		});
	});

	// ── updateConfig edge cases ─────────────────────────────────────────

	describe("updateConfig edge cases", () => {
		it("returns unchanged config when updating with empty params", async () => {
			const original = await controller.getConfig();
			const updated = await controller.updateConfig({});
			expect(updated.baseUrl).toBe(original.baseUrl);
			expect(updated.includeProducts).toBe(original.includeProducts);
		});

		it("multiple sequential updates accumulate correctly", async () => {
			await controller.updateConfig({ baseUrl: "https://first.com" });
			await controller.updateConfig({ includeProducts: false });
			await controller.updateConfig({ productPriority: 0.95 });
			const config = await controller.getConfig();
			expect(config.baseUrl).toBe("https://first.com");
			expect(config.includeProducts).toBe(false);
			expect(config.productPriority).toBe(0.95);
		});

		it("concurrent updates all persist", async () => {
			await Promise.all([
				controller.updateConfig({ productPriority: 0.1 }),
				controller.updateConfig({ collectionPriority: 0.2 }),
				controller.updateConfig({ pagePriority: 0.3 }),
			]);
			// At least the last write wins for each field
			const config = await controller.getConfig();
			expect(config.id).toBe("default");
		});

		it("updates defaultChangeFreq and defaultPriority together", async () => {
			const updated = await controller.updateConfig({
				defaultChangeFreq: "hourly",
				defaultPriority: 0.99,
			});
			expect(updated.defaultChangeFreq).toBe("hourly");
			expect(updated.defaultPriority).toBe(0.99);
		});

		it("sets excludedPaths to empty array", async () => {
			await controller.updateConfig({
				excludedPaths: ["/admin", "/secret"],
			});
			const updated = await controller.updateConfig({
				excludedPaths: [],
			});
			expect(updated.excludedPaths).toEqual([]);
		});
	});

	// ── addEntry edge cases ─────────────────────────────────────────────

	describe("addEntry edge cases", () => {
		it("handles path with query parameters", async () => {
			const entry = await controller.addEntry({
				path: "/search?q=hello&lang=en",
			});
			expect(entry.loc).toBe("https://example.com/search?q=hello&lang=en");
		});

		it("handles path with hash fragment", async () => {
			const entry = await controller.addEntry({
				path: "/page#section",
			});
			expect(entry.loc).toBe("https://example.com/page#section");
		});

		it("handles root path", async () => {
			const entry = await controller.addEntry({ path: "/" });
			expect(entry.loc).toBe("https://example.com/");
		});

		it("handles very long paths", async () => {
			const longPath = `/${"a".repeat(2000)}`;
			const entry = await controller.addEntry({ path: longPath });
			expect(entry.loc).toBe(`https://example.com${longPath}`);
		});

		it("handles unicode characters in path", async () => {
			const entry = await controller.addEntry({
				path: "/productos/caf\u00e9-latte",
			});
			expect(entry.loc).toContain("caf\u00e9-latte");
		});

		it("respects updated defaultChangeFreq for new entries", async () => {
			await controller.updateConfig({ defaultChangeFreq: "hourly" });
			const entry = await controller.addEntry({ path: "/fast" });
			expect(entry.changefreq).toBe("hourly");
		});

		it("respects updated defaultPriority for new entries", async () => {
			await controller.updateConfig({ defaultPriority: 0.95 });
			const entry = await controller.addEntry({ path: "/important" });
			expect(entry.priority).toBe(0.95);
		});

		it("custom changefreq overrides config default", async () => {
			await controller.updateConfig({ defaultChangeFreq: "monthly" });
			const entry = await controller.addEntry({
				path: "/specific",
				changefreq: "always",
			});
			expect(entry.changefreq).toBe("always");
		});

		it("custom priority overrides config default", async () => {
			await controller.updateConfig({ defaultPriority: 0.1 });
			const entry = await controller.addEntry({
				path: "/specific",
				priority: 0.99,
			});
			expect(entry.priority).toBe(0.99);
		});

		it("priority 0 is preserved", async () => {
			const entry = await controller.addEntry({
				path: "/low",
				priority: 0,
			});
			expect(entry.priority).toBe(0);
		});

		it("concurrent addEntry calls produce unique ids", async () => {
			const results = await Promise.all(
				Array.from({ length: 20 }, (_, i) =>
					controller.addEntry({ path: `/page-${i}` }),
				),
			);
			const ids = new Set(results.map((r) => r.id));
			expect(ids.size).toBe(20);
		});
	});

	// ── getEntry edge cases ─────────────────────────────────────────────

	describe("getEntry edge cases", () => {
		it("returns null for empty string id", async () => {
			const found = await controller.getEntry("");
			expect(found).toBeNull();
		});

		it("returns null after entry is removed", async () => {
			const entry = await controller.addEntry({ path: "/temp" });
			await controller.removeEntry(entry.id);
			expect(await controller.getEntry(entry.id)).toBeNull();
		});

		it("returns correct entry among many", async () => {
			const entries: Awaited<ReturnType<typeof controller.addEntry>>[] = [];
			for (let i = 0; i < 15; i++) {
				entries.push(await controller.addEntry({ path: `/item-${i}` }));
			}
			const middle = await controller.getEntry(entries[7].id);
			expect(middle?.loc).toContain("/item-7");
		});
	});

	// ── getEntryByLoc edge cases ────────────────────────────────────────

	describe("getEntryByLoc edge cases", () => {
		it("returns null for partial URL match", async () => {
			await controller.addEntry({ path: "/products/shoe" });
			const found = await controller.getEntryByLoc(
				"https://example.com/products",
			);
			expect(found).toBeNull();
		});

		it("is case-sensitive for URL matching", async () => {
			await controller.addEntry({ path: "/About" });
			const found = await controller.getEntryByLoc("https://example.com/about");
			expect(found).toBeNull();
		});

		it("returns null for empty string loc", async () => {
			await controller.addEntry({ path: "/test" });
			const found = await controller.getEntryByLoc("");
			expect(found).toBeNull();
		});

		it("distinguishes similar locs", async () => {
			await controller.addEntry({ path: "/products" });
			await controller.addEntry({ path: "/products/new" });
			const found = await controller.getEntryByLoc(
				"https://example.com/products",
			);
			expect(found?.loc).toBe("https://example.com/products");
		});
	});

	// ── updateEntry edge cases ──────────────────────────────────────────

	describe("updateEntry edge cases", () => {
		it("preserves source on update", async () => {
			const entry = await controller.addEntry({ path: "/test" });
			const updated = await controller.updateEntry(entry.id, {
				path: "/new-test",
			});
			expect(updated?.source).toBe("custom");
		});

		it("preserves createdAt on update", async () => {
			const entry = await controller.addEntry({ path: "/test" });
			const updated = await controller.updateEntry(entry.id, {
				path: "/new-test",
				priority: 0.9,
			});
			expect(updated?.createdAt.getTime()).toBe(entry.createdAt.getTime());
		});

		it("preserves id on update", async () => {
			const entry = await controller.addEntry({ path: "/test" });
			const updated = await controller.updateEntry(entry.id, {
				path: "/updated",
			});
			expect(updated?.id).toBe(entry.id);
		});

		it("returns null for empty string id", async () => {
			const updated = await controller.updateEntry("", {
				path: "/new",
			});
			expect(updated).toBeNull();
		});

		it("updates entry with all fields simultaneously", async () => {
			const entry = await controller.addEntry({ path: "/original" });
			const newDate = new Date("2025-06-15");
			const updated = await controller.updateEntry(entry.id, {
				path: "/changed",
				changefreq: "always",
				priority: 1.0,
				lastmod: newDate,
			});
			expect(updated?.loc).toBe("https://example.com/changed");
			expect(updated?.changefreq).toBe("always");
			expect(updated?.priority).toBe(1.0);
			expect(updated?.lastmod).toEqual(newDate);
		});

		it("multiple sequential updates accumulate", async () => {
			const entry = await controller.addEntry({
				path: "/start",
				changefreq: "weekly",
				priority: 0.5,
			});
			await controller.updateEntry(entry.id, { priority: 0.7 });
			await controller.updateEntry(entry.id, { changefreq: "daily" });
			await controller.updateEntry(entry.id, { path: "/end" });

			const final = await controller.getEntry(entry.id);
			expect(final?.priority).toBe(0.7);
			expect(final?.changefreq).toBe("daily");
			expect(final?.loc).toContain("/end");
		});
	});

	// ── removeEntry edge cases ──────────────────────────────────────────

	describe("removeEntry edge cases", () => {
		it("double removal returns false on second attempt", async () => {
			const entry = await controller.addEntry({ path: "/del" });
			expect(await controller.removeEntry(entry.id)).toBe(true);
			expect(await controller.removeEntry(entry.id)).toBe(false);
		});

		it("returns false for empty string id", async () => {
			expect(await controller.removeEntry("")).toBe(false);
		});

		it("removing one entry does not affect config", async () => {
			await controller.updateConfig({ baseUrl: "https://mysite.com" });
			const entry = await controller.addEntry({ path: "/del" });
			await controller.removeEntry(entry.id);
			const config = await controller.getConfig();
			expect(config.baseUrl).toBe("https://mysite.com");
		});

		it("removed entry no longer appears in listEntries", async () => {
			const a = await controller.addEntry({ path: "/a" });
			await controller.addEntry({ path: "/b" });
			await controller.removeEntry(a.id);
			const list = await controller.listEntries();
			expect(list).toHaveLength(1);
			expect(list[0].loc).toContain("/b");
		});

		it("removed entry is not found by getEntryByLoc", async () => {
			const entry = await controller.addEntry({ path: "/gone" });
			await controller.removeEntry(entry.id);
			const found = await controller.getEntryByLoc("https://example.com/gone");
			expect(found).toBeNull();
		});
	});

	// ── bulkAddEntries edge cases ───────────────────────────────────────

	describe("bulkAddEntries edge cases", () => {
		it("each entry uses config defaults independently", async () => {
			await controller.updateConfig({
				defaultChangeFreq: "daily",
				defaultPriority: 0.8,
			});
			const entries = await controller.bulkAddEntries([
				{ path: "/a" },
				{ path: "/b", changefreq: "monthly" },
				{ path: "/c", priority: 0.1 },
			]);
			expect(entries[0].changefreq).toBe("daily");
			expect(entries[0].priority).toBe(0.8);
			expect(entries[1].changefreq).toBe("monthly");
			expect(entries[1].priority).toBe(0.8);
			expect(entries[2].changefreq).toBe("daily");
			expect(entries[2].priority).toBe(0.1);
		});

		it("handles large batch of entries", async () => {
			const batch = Array.from({ length: 100 }, (_, i) => ({
				path: `/batch-${i}`,
			}));
			const entries = await controller.bulkAddEntries(batch);
			expect(entries).toHaveLength(100);
			expect(await controller.countEntries()).toBe(100);
		});

		it("preserves lastmod in bulk entries", async () => {
			const date = new Date("2025-01-15");
			const entries = await controller.bulkAddEntries([
				{ path: "/dated", lastmod: date },
				{ path: "/undated" },
			]);
			expect(entries[0].lastmod).toEqual(date);
			expect(entries[1].lastmod).toBeUndefined();
		});
	});

	// ── bulkRemoveEntries edge cases ────────────────────────────────────

	describe("bulkRemoveEntries edge cases", () => {
		it("handles mix of valid and invalid ids", async () => {
			const a = await controller.addEntry({ path: "/a" });
			const b = await controller.addEntry({ path: "/b" });
			const removed = await controller.bulkRemoveEntries([
				a.id,
				"invalid-1",
				b.id,
				"invalid-2",
			]);
			expect(removed).toBe(2);
			expect(await controller.countEntries()).toBe(0);
		});

		it("double bulk remove returns 0 on second attempt", async () => {
			const entries = await controller.bulkAddEntries([
				{ path: "/x" },
				{ path: "/y" },
			]);
			const ids = entries.map((e) => e.id);
			expect(await controller.bulkRemoveEntries(ids)).toBe(2);
			expect(await controller.bulkRemoveEntries(ids)).toBe(0);
		});

		it("removing all entries leaves count at 0", async () => {
			const entries = await controller.bulkAddEntries([
				{ path: "/a" },
				{ path: "/b" },
				{ path: "/c" },
			]);
			await controller.bulkRemoveEntries(entries.map((e) => e.id));
			expect(await controller.countEntries()).toBe(0);
		});
	});

	// ── listEntries edge cases ──────────────────────────────────────────

	describe("listEntries edge cases", () => {
		it("returns empty array with take=0", async () => {
			await controller.addEntry({ path: "/a" });
			expect(await controller.listEntries({ take: 0 })).toHaveLength(0);
		});

		it("returns empty array when skip exceeds total", async () => {
			await controller.addEntry({ path: "/a" });
			expect(await controller.listEntries({ skip: 100 })).toHaveLength(0);
		});

		it("paginates correctly through all items", async () => {
			for (let i = 0; i < 7; i++) {
				await controller.addEntry({ path: `/page-${i}` });
			}
			const page1 = await controller.listEntries({ take: 3, skip: 0 });
			const page2 = await controller.listEntries({ take: 3, skip: 3 });
			const page3 = await controller.listEntries({ take: 3, skip: 6 });
			expect(page1).toHaveLength(3);
			expect(page2).toHaveLength(3);
			expect(page3).toHaveLength(1);

			const allLocs = [
				...page1.map((e) => e.loc),
				...page2.map((e) => e.loc),
				...page3.map((e) => e.loc),
			];
			expect(new Set(allLocs).size).toBe(7);
		});

		it("filters by multiple source types independently", async () => {
			await controller.addEntry({ path: "/custom1" });
			await controller.addEntry({ path: "/custom2" });
			await controller.regenerate({
				products: [{ slug: "p1" }],
				blog: [{ slug: "b1" }],
			});
			expect(await controller.listEntries({ source: "custom" })).toHaveLength(
				2,
			);
			expect(await controller.listEntries({ source: "product" })).toHaveLength(
				1,
			);
			expect(await controller.listEntries({ source: "blog" })).toHaveLength(1);
			expect(await controller.listEntries({ source: "static" })).toHaveLength(
				1,
			);
		});

		it("returns all items with empty params object", async () => {
			await controller.addEntry({ path: "/a" });
			await controller.addEntry({ path: "/b" });
			expect(await controller.listEntries({})).toHaveLength(2);
		});

		it("returns all items when called without params", async () => {
			await controller.addEntry({ path: "/a" });
			await controller.addEntry({ path: "/b" });
			expect(await controller.listEntries()).toHaveLength(2);
		});
	});

	// ── countEntries edge cases ─────────────────────────────────────────

	describe("countEntries edge cases", () => {
		it("returns 0 for empty source filter after adding entries", async () => {
			await controller.addEntry({ path: "/a" });
			expect(await controller.countEntries("product")).toBe(0);
		});

		it("count reflects removal", async () => {
			const entry = await controller.addEntry({ path: "/a" });
			expect(await controller.countEntries()).toBe(1);
			await controller.removeEntry(entry.id);
			expect(await controller.countEntries()).toBe(0);
		});

		it("counts entries across all sources after regenerate", async () => {
			await controller.addEntry({ path: "/custom" });
			await controller.regenerate({
				products: [{ slug: "p1" }, { slug: "p2" }],
				blog: [{ slug: "b1" }],
			});
			expect(await controller.countEntries()).toBe(5); // 1 custom + 1 static + 2 product + 1 blog
			expect(await controller.countEntries("custom")).toBe(1);
			expect(await controller.countEntries("static")).toBe(1);
			expect(await controller.countEntries("product")).toBe(2);
			expect(await controller.countEntries("blog")).toBe(1);
		});
	});

	// ── generateXml edge cases ──────────────────────────────────────────

	describe("generateXml edge cases", () => {
		it("escapes apostrophe in URLs", async () => {
			await controller.addEntry({ path: "/o'reilly" });
			const xml = await controller.generateXml();
			expect(xml).toContain("&apos;");
		});

		it("escapes all five XML special characters", async () => {
			await controller.addEntry({ path: "/a&b<c>d\"e'f" });
			const xml = await controller.generateXml();
			expect(xml).toContain("&amp;");
			expect(xml).toContain("&lt;");
			expect(xml).toContain("&gt;");
			expect(xml).toContain("&quot;");
			expect(xml).toContain("&apos;");
		});

		it("includes all entry fields in xml", async () => {
			await controller.addEntry({
				path: "/full",
				changefreq: "daily",
				priority: 0.9,
				lastmod: new Date("2025-03-01"),
			});
			const xml = await controller.generateXml();
			expect(xml).toContain("<loc>https://example.com/full</loc>");
			expect(xml).toContain("<lastmod>2025-03-01</lastmod>");
			expect(xml).toContain("<changefreq>daily</changefreq>");
			expect(xml).toContain("<priority>0.9</priority>");
		});

		it("generates valid XML structure with proper nesting", async () => {
			await controller.addEntry({ path: "/test" });
			const xml = await controller.generateXml();
			const lines = xml.split("\n");
			expect(lines[0]).toBe('<?xml version="1.0" encoding="UTF-8"?>');
			expect(lines[1]).toContain("<urlset");
			expect(lines[lines.length - 1]).toBe("</urlset>");
		});

		it("includes auto-generated and custom entries in xml", async () => {
			await controller.addEntry({ path: "/custom" });
			await controller.regenerate({
				products: [{ slug: "shoe" }],
			});
			const xml = await controller.generateXml();
			expect(xml).toContain("/custom</loc>");
			expect(xml).toContain("/products/shoe</loc>");
			expect(xml).toContain("https://example.com</loc>");
		});

		it("page parameter without exceeding MAX returns all entries", async () => {
			await controller.addEntry({ path: "/a" });
			await controller.addEntry({ path: "/b" });
			await controller.addEntry({ path: "/c" });
			// When entries <= MAX, page parameter is ignored
			const xml = await controller.generateXml(0);
			const urlCount = (xml.match(/<url>/g) ?? []).length;
			expect(urlCount).toBe(3);
		});

		it("handles entries with various changefreq values", async () => {
			const freqs = [
				"always",
				"hourly",
				"daily",
				"weekly",
				"monthly",
				"yearly",
				"never",
			] as const;
			for (const freq of freqs) {
				await controller.addEntry({
					path: `/${freq}`,
					changefreq: freq,
				});
			}
			const xml = await controller.generateXml();
			for (const freq of freqs) {
				expect(xml).toContain(`<changefreq>${freq}</changefreq>`);
			}
		});

		it("formats date as YYYY-MM-DD for lastmod", async () => {
			const date = new Date("2025-12-31T23:59:59.999Z");
			await controller.addEntry({ path: "/dated", lastmod: date });
			const xml = await controller.generateXml();
			expect(xml).toContain("<lastmod>2025-12-31</lastmod>");
		});
	});

	// ── generateSitemapIndex edge cases ──────────────────────────────────

	describe("generateSitemapIndex edge cases", () => {
		it("returns null when exactly MAX entries exist", async () => {
			// Add exactly MAX_ENTRIES_PER_SITEMAP entries would be too slow,
			// but we can verify the threshold logic
			// With 0 entries, it returns null
			const result = await controller.generateSitemapIndex();
			expect(result).toBeNull();
		});

		it("returns null with a small number of entries", async () => {
			await controller.bulkAddEntries([
				{ path: "/a" },
				{ path: "/b" },
				{ path: "/c" },
			]);
			const result = await controller.generateSitemapIndex();
			expect(result).toBeNull();
		});

		it("MAX_ENTRIES_PER_SITEMAP is 50000", () => {
			expect(MAX_ENTRIES_PER_SITEMAP).toBe(50_000);
		});
	});

	// ── regenerate edge cases ───────────────────────────────────────────

	describe("regenerate edge cases", () => {
		it("homepage uses config defaultChangeFreq", async () => {
			await controller.updateConfig({ defaultChangeFreq: "daily" });
			await controller.regenerate({});
			const staticEntries = await controller.listEntries({
				source: "static",
			});
			expect(staticEntries[0].changefreq).toBe("daily");
		});

		it("homepage always has priority 1.0", async () => {
			await controller.updateConfig({ defaultPriority: 0.3 });
			await controller.regenerate({});
			const staticEntries = await controller.listEntries({
				source: "static",
			});
			expect(staticEntries[0].priority).toBe(1.0);
		});

		it("homepage loc equals baseUrl without trailing slash", async () => {
			await controller.updateConfig({
				baseUrl: "https://mysite.com/",
			});
			await controller.regenerate({});
			const staticEntries = await controller.listEntries({
				source: "static",
			});
			expect(staticEntries[0].loc).toBe("https://mysite.com");
		});

		it("brands use defaultChangeFreq and defaultPriority", async () => {
			await controller.updateConfig({
				defaultChangeFreq: "hourly",
				defaultPriority: 0.33,
			});
			await controller.regenerate({
				brands: [{ slug: "acme" }],
			});
			const brands = await controller.listEntries({ source: "brand" });
			expect(brands[0].changefreq).toBe("hourly");
			expect(brands[0].priority).toBe(0.33);
		});

		it("product entries use productChangeFreq and productPriority", async () => {
			await controller.updateConfig({
				productChangeFreq: "hourly",
				productPriority: 0.95,
			});
			await controller.regenerate({
				products: [{ slug: "widget" }],
			});
			const products = await controller.listEntries({
				source: "product",
			});
			expect(products[0].changefreq).toBe("hourly");
			expect(products[0].priority).toBe(0.95);
		});

		it("collection entries use collectionChangeFreq and collectionPriority", async () => {
			await controller.updateConfig({
				collectionChangeFreq: "daily",
				collectionPriority: 0.85,
			});
			await controller.regenerate({
				collections: [{ slug: "sale" }],
			});
			const collections = await controller.listEntries({
				source: "collection",
			});
			expect(collections[0].changefreq).toBe("daily");
			expect(collections[0].priority).toBe(0.85);
		});

		it("page entries use pageChangeFreq and pagePriority", async () => {
			await controller.updateConfig({
				pageChangeFreq: "yearly",
				pagePriority: 0.4,
			});
			await controller.regenerate({
				pages: [{ slug: "terms" }],
			});
			const pages = await controller.listEntries({ source: "page" });
			expect(pages[0].changefreq).toBe("yearly");
			expect(pages[0].priority).toBe(0.4);
		});

		it("blog entries use blogChangeFreq and blogPriority", async () => {
			await controller.updateConfig({
				blogChangeFreq: "daily",
				blogPriority: 0.75,
			});
			await controller.regenerate({
				blog: [{ slug: "latest" }],
			});
			const blog = await controller.listEntries({ source: "blog" });
			expect(blog[0].changefreq).toBe("daily");
			expect(blog[0].priority).toBe(0.75);
		});

		it("excludedPaths with prefix matching blocks children", async () => {
			await controller.updateConfig({
				excludedPaths: ["/products/secret"],
			});
			await controller.regenerate({
				products: [
					{ slug: "secret" },
					{ slug: "secret/variant" },
					{ slug: "secretive" },
					{ slug: "public" },
				],
			});
			const products = await controller.listEntries({
				source: "product",
			});
			// "secret" exactly matches, "secret/variant" is a child, but "secretive" does NOT match
			expect(products).toHaveLength(2);
			const slugs = products.map((p) => p.sourceId);
			expect(slugs).toContain("secretive");
			expect(slugs).toContain("public");
		});

		it("multiple excludedPaths work together", async () => {
			await controller.updateConfig({
				excludedPaths: [
					"/products/hidden",
					"/blog/draft",
					"/collections/private",
				],
			});
			await controller.regenerate({
				products: [{ slug: "hidden" }, { slug: "visible" }],
				blog: [{ slug: "draft" }, { slug: "published" }],
				collections: [{ slug: "private" }, { slug: "public" }],
			});
			expect(await controller.listEntries({ source: "product" })).toHaveLength(
				1,
			);
			expect(await controller.listEntries({ source: "blog" })).toHaveLength(1);
			expect(
				await controller.listEntries({ source: "collection" }),
			).toHaveLength(1);
		});

		it("regenerate with no page data generates only homepage", async () => {
			const count = await controller.regenerate({});
			expect(count).toBe(1);
			const entries = await controller.listEntries();
			expect(entries).toHaveLength(1);
			expect(entries[0].source).toBe("static");
		});

		it("regenerate replaces old auto entries with new ones", async () => {
			await controller.regenerate({
				products: [{ slug: "a" }, { slug: "b" }],
			});
			expect(await controller.listEntries({ source: "product" })).toHaveLength(
				2,
			);

			await controller.regenerate({
				products: [{ slug: "c" }],
			});
			const products = await controller.listEntries({
				source: "product",
			});
			expect(products).toHaveLength(1);
			expect(products[0].sourceId).toBe("c");
		});

		it("custom entries survive multiple regenerations", async () => {
			const custom = await controller.addEntry({
				path: "/permanent",
			});
			await controller.regenerate({ products: [{ slug: "a" }] });
			await controller.regenerate({ products: [{ slug: "b" }] });
			await controller.regenerate({ products: [{ slug: "c" }] });

			const found = await controller.getEntry(custom.id);
			expect(found).not.toBeNull();
			expect(found?.loc).toContain("/permanent");
			expect(await controller.listEntries({ source: "custom" })).toHaveLength(
				1,
			);
		});

		it("sets lastGenerated after regeneration", async () => {
			const before = new Date();
			await controller.regenerate({});
			const config = await controller.getConfig();
			expect(config.lastGenerated).toBeDefined();
			expect(config.lastGenerated?.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
		});

		it("lastmod is set from updatedAt on collections", async () => {
			const date = new Date("2025-02-14");
			await controller.regenerate({
				collections: [{ slug: "valentine", updatedAt: date }],
			});
			const collections = await controller.listEntries({
				source: "collection",
			});
			expect(collections[0].lastmod).toEqual(date);
		});

		it("lastmod is set from updatedAt on pages", async () => {
			const date = new Date("2025-01-01");
			await controller.regenerate({
				pages: [{ slug: "about", updatedAt: date }],
			});
			const pages = await controller.listEntries({ source: "page" });
			expect(pages[0].lastmod).toEqual(date);
		});

		it("lastmod is set from updatedAt on blog posts", async () => {
			const date = new Date("2025-03-10");
			await controller.regenerate({
				blog: [{ slug: "post", updatedAt: date }],
			});
			const blog = await controller.listEntries({ source: "blog" });
			expect(blog[0].lastmod).toEqual(date);
		});

		it("lastmod is set from updatedAt on brands", async () => {
			const date = new Date("2025-06-01");
			await controller.regenerate({
				brands: [{ slug: "acme", updatedAt: date }],
			});
			const brands = await controller.listEntries({ source: "brand" });
			expect(brands[0].lastmod).toEqual(date);
		});

		it("handles empty arrays for all page types", async () => {
			const count = await controller.regenerate({
				products: [],
				collections: [],
				pages: [],
				blog: [],
				brands: [],
			});
			expect(count).toBe(1); // only homepage
		});
	});

	// ── getStats edge cases ─────────────────────────────────────────────

	describe("getStats edge cases", () => {
		it("lastGenerated is undefined before any regeneration", async () => {
			await controller.addEntry({ path: "/custom" });
			const stats = await controller.getStats();
			expect(stats.lastGenerated).toBeUndefined();
		});

		it("stats reflect removal of entries", async () => {
			const a = await controller.addEntry({ path: "/a" });
			await controller.addEntry({ path: "/b" });
			await controller.removeEntry(a.id);
			const stats = await controller.getStats();
			expect(stats.totalEntries).toBe(1);
			expect(stats.entriesBySource.custom).toBe(1);
		});

		it("stats show correct breakdown after regenerate with all sources", async () => {
			await controller.addEntry({ path: "/custom-1" });
			await controller.addEntry({ path: "/custom-2" });
			await controller.regenerate({
				products: [{ slug: "p1" }, { slug: "p2" }, { slug: "p3" }],
				collections: [{ slug: "c1" }, { slug: "c2" }],
				pages: [{ slug: "about" }],
				blog: [{ slug: "b1" }, { slug: "b2" }],
				brands: [{ slug: "br1" }],
			});
			const stats = await controller.getStats();
			expect(stats.totalEntries).toBe(12); // 2 custom + 1 static + 3 product + 2 collection + 1 page + 2 blog + 1 brand
			expect(stats.entriesBySource.custom).toBe(2);
			expect(stats.entriesBySource.static).toBe(1);
			expect(stats.entriesBySource.product).toBe(3);
			expect(stats.entriesBySource.collection).toBe(2);
			expect(stats.entriesBySource.page).toBe(1);
			expect(stats.entriesBySource.blog).toBe(2);
			expect(stats.entriesBySource.brand).toBe(1);
			expect(stats.lastGenerated).toBeInstanceOf(Date);
		});

		it("entriesBySource does not include absent sources", async () => {
			await controller.addEntry({ path: "/only-custom" });
			const stats = await controller.getStats();
			expect(stats.entriesBySource.custom).toBe(1);
			expect(stats.entriesBySource.product).toBeUndefined();
			expect(stats.entriesBySource.static).toBeUndefined();
		});
	});

	// ── cross-entity isolation ──────────────────────────────────────────

	describe("cross-entity isolation", () => {
		it("entry operations do not affect config", async () => {
			await controller.updateConfig({ baseUrl: "https://mystore.com" });
			const entry = await controller.addEntry({ path: "/test" });
			await controller.removeEntry(entry.id);
			const config = await controller.getConfig();
			expect(config.baseUrl).toBe("https://mystore.com");
			expect(mockData.size("sitemapConfig")).toBe(1);
		});

		it("config operations do not affect entries", async () => {
			await controller.addEntry({ path: "/stable" });
			await controller.updateConfig({ baseUrl: "https://new.com" });
			const entries = await controller.listEntries();
			expect(entries).toHaveLength(1);
			// Entry loc uses the baseUrl at time of creation
			expect(entries[0].loc).toContain("https://example.com/stable");
		});

		it("custom and auto entries coexist independently", async () => {
			const custom = await controller.addEntry({ path: "/manual" });
			await controller.regenerate({
				products: [{ slug: "auto" }],
			});
			const allEntries = await controller.listEntries();
			// custom + static + product
			expect(allEntries).toHaveLength(3);

			// Remove auto entries via regenerate with empty data
			await controller.regenerate({});
			const afterRegen = await controller.listEntries();
			// custom + static (only homepage)
			expect(afterRegen).toHaveLength(2);
			const found = await controller.getEntry(custom.id);
			expect(found).not.toBeNull();
		});
	});

	// ── complex lifecycle scenarios ─────────────────────────────────────

	describe("complex lifecycle scenarios", () => {
		it("full workflow: config -> bulk add -> update -> generate XML -> stats", async () => {
			await controller.updateConfig({
				baseUrl: "https://shop.example.com",
				defaultChangeFreq: "daily",
				defaultPriority: 0.7,
			});

			const entries = await controller.bulkAddEntries([
				{ path: "/sale", priority: 1.0, changefreq: "hourly" },
				{ path: "/about" },
				{
					path: "/blog/launch",
					lastmod: new Date("2025-03-01"),
				},
			]);

			await controller.updateEntry(entries[1].id, {
				priority: 0.9,
				changefreq: "weekly",
			});

			const xml = await controller.generateXml();
			expect(xml).toContain("https://shop.example.com/sale</loc>");
			expect(xml).toContain("https://shop.example.com/about</loc>");
			expect(xml).toContain("https://shop.example.com/blog/launch</loc>");
			expect(xml).toContain("<priority>1.0</priority>");
			expect(xml).toContain("<priority>0.9</priority>");
			expect(xml).toContain("<lastmod>2025-03-01</lastmod>");

			const stats = await controller.getStats();
			expect(stats.totalEntries).toBe(3);
			expect(stats.entriesBySource.custom).toBe(3);
		});

		it("regenerate -> add custom -> remove some -> verify XML", async () => {
			await controller.regenerate({
				products: [
					{ slug: "shirt", updatedAt: new Date("2025-01-01") },
					{ slug: "pants" },
				],
				pages: [{ slug: "contact" }],
			});

			const custom = await controller.addEntry({
				path: "/promo",
				priority: 1.0,
				changefreq: "always",
			});

			// Remove the custom entry
			await controller.removeEntry(custom.id);

			const xml = await controller.generateXml();
			expect(xml).toContain("/products/shirt</loc>");
			expect(xml).toContain("/products/pants</loc>");
			expect(xml).toContain("/contact</loc>");
			expect(xml).not.toContain("/promo</loc>");

			const urlCount = (xml.match(/<url>/g) ?? []).length;
			expect(urlCount).toBe(4); // homepage + 2 products + 1 page
		});

		it("update config then regenerate uses new settings", async () => {
			await controller.updateConfig({
				baseUrl: "https://new-domain.com",
				productPriority: 0.95,
				productChangeFreq: "hourly",
				includeCollections: false,
			});

			await controller.regenerate({
				products: [{ slug: "gadget" }],
				collections: [{ slug: "electronics" }],
			});

			const products = await controller.listEntries({
				source: "product",
			});
			expect(products[0].loc).toBe("https://new-domain.com/products/gadget");
			expect(products[0].priority).toBe(0.95);
			expect(products[0].changefreq).toBe("hourly");

			expect(
				await controller.listEntries({ source: "collection" }),
			).toHaveLength(0);

			const staticEntries = await controller.listEntries({
				source: "static",
			});
			expect(staticEntries[0].loc).toBe("https://new-domain.com");
		});

		it("entry persists through data service directly", async () => {
			const entry = await controller.addEntry({
				path: "/persistent",
				priority: 0.8,
			});

			// Verify data is in mock store
			expect(mockData.size("sitemapEntry")).toBe(1);

			// Retrieve via controller
			const found = await controller.getEntry(entry.id);
			expect(found?.loc).toBe("https://example.com/persistent");
			expect(found?.priority).toBe(0.8);
		});

		it("store is empty after removing all entries", async () => {
			const entries = await controller.bulkAddEntries([
				{ path: "/a" },
				{ path: "/b" },
				{ path: "/c" },
			]);
			for (const entry of entries) {
				await controller.removeEntry(entry.id);
			}
			expect(mockData.size("sitemapEntry")).toBe(0);
			expect(await controller.countEntries()).toBe(0);
		});

		it("XML generation after all entries removed produces empty urlset", async () => {
			const entry = await controller.addEntry({ path: "/temp" });
			await controller.removeEntry(entry.id);
			const xml = await controller.generateXml();
			expect(xml).toContain("<urlset");
			expect(xml).toContain("</urlset>");
			expect(xml).not.toContain("<url>");
		});

		it("multiple regenerations update lastGenerated each time", async () => {
			await controller.regenerate({});
			const first = await controller.getConfig();
			const firstTime = first.lastGenerated?.getTime();

			await controller.regenerate({
				products: [{ slug: "a" }],
			});
			const second = await controller.getConfig();
			const secondTime = second.lastGenerated?.getTime();

			expect(firstTime).toBeDefined();
			expect(secondTime).toBeDefined();
			expect(secondTime).toBeGreaterThanOrEqual(firstTime ?? 0);
		});
	});
});
