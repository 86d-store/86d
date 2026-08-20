import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSearchController } from "../service-impl";

describe("search controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSearchController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSearchController(mockData);
	});

	// ── indexItem — deduplication and metadata ───────────────────────

	describe("indexItem — metadata and deduplication", () => {
		it("stores custom metadata", async () => {
			const item = await controller.indexItem({
				entityType: "product",
				entityId: "prod_m1",
				title: "Widget",
				url: "/products/widget",
				metadata: { price: 1999, currency: "USD" },
			});
			expect(item.metadata).toEqual({ price: 1999, currency: "USD" });
		});

		it("re-indexing preserves same ID", async () => {
			const first = await controller.indexItem({
				entityType: "product",
				entityId: "prod_dup",
				title: "Original",
				url: "/p/orig",
			});
			const second = await controller.indexItem({
				entityType: "product",
				entityId: "prod_dup",
				title: "Updated",
				url: "/p/updated",
			});
			expect(second.id).toBe(first.id);
			expect(second.title).toBe("Updated");
			expect(second.url).toBe("/p/updated");
		});

		it("different entity types with same entityId are separate", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "shared_id",
				title: "Product",
				url: "/p/shared",
			});
			await controller.indexItem({
				entityType: "blog",
				entityId: "shared_id",
				title: "Blog Post",
				url: "/b/shared",
			});
			expect(await controller.getIndexCount()).toBe(2);
		});

		it("stores image URL", async () => {
			const item = await controller.indexItem({
				entityType: "product",
				entityId: "img_prod",
				title: "Photo Widget",
				url: "/products/photo",
				image: "/images/photo.jpg",
			});
			expect(item.image).toBe("/images/photo.jpg");
		});
	});

	// ── search — scoring edge cases ─────────────────────────────────

	describe("search — scoring and ranking", () => {
		beforeEach(async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "exact",
				title: "red",
				body: "A plain item",
				tags: ["simple"],
				url: "/products/exact",
			});
			await controller.indexItem({
				entityType: "product",
				entityId: "prefix",
				title: "red shoes",
				body: "Comfortable shoes in red",
				tags: ["footwear", "red"],
				url: "/products/prefix",
			});
			await controller.indexItem({
				entityType: "product",
				entityId: "body_only",
				title: "Blue Sneakers",
				body: "Available in red and blue",
				tags: ["footwear"],
				url: "/products/body-only",
			});
		});

		it("exact title match scores highest", async () => {
			const { results } = await controller.search("red");
			expect(results.length).toBeGreaterThanOrEqual(2);
			// "red" (exact title match) should score higher than "red shoes" (prefix)
			expect(results[0].item.entityId).toBe("exact");
		});

		it("multi-word queries match across fields", async () => {
			const { results } = await controller.search("red footwear");
			expect(results.length).toBeGreaterThan(0);
			// "red shoes" has "red" in title and "footwear" in tags
			const topIds = results.map((r) => r.item.entityId);
			expect(topIds).toContain("prefix");
		});

		it("non-matching query returns empty", async () => {
			const { results, total } = await controller.search("xyznonexistent123");
			expect(results).toHaveLength(0);
			expect(total).toBe(0);
		});

		it("whitespace-only query returns empty", async () => {
			const { results } = await controller.search("   \t  ");
			expect(results).toHaveLength(0);
		});

		it("hyphenated terms are tokenized", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "hyphen",
				title: "t-shirt",
				url: "/products/t-shirt",
			});
			// Searching "shirt" should match the tokenized "shirt"
			const { results } = await controller.search("shirt");
			const ids = results.map((r) => r.item.entityId);
			expect(ids).toContain("hyphen");
		});

		it("case-insensitive matching", async () => {
			const { results } = await controller.search("RED SHOES");
			expect(results.length).toBeGreaterThan(0);
			const ids = results.map((r) => r.item.entityId);
			expect(ids).toContain("prefix");
		});
	});

	// ── search — entityType filtering ───────────────────────────────

	describe("search — entity type filtering", () => {
		beforeEach(async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "prod_1",
				title: "Red Widget",
				url: "/p/red",
			});
			await controller.indexItem({
				entityType: "blog",
				entityId: "post_1",
				title: "Red is the New Black",
				url: "/b/red",
			});
			await controller.indexItem({
				entityType: "page",
				entityId: "page_1",
				title: "About Our Red Collection",
				url: "/about/red",
			});
		});

		it("filters to products only", async () => {
			const { results } = await controller.search("red", {
				entityType: "product",
			});
			for (const r of results) {
				expect(r.item.entityType).toBe("product");
			}
			expect(results.length).toBe(1);
		});

		it("filters to blog only", async () => {
			const { results } = await controller.search("red", {
				entityType: "blog",
			});
			expect(results).toHaveLength(1);
			expect(results[0].item.entityType).toBe("blog");
		});

		it("returns all types when no filter", async () => {
			const { results } = await controller.search("red");
			const types = new Set(results.map((r) => r.item.entityType));
			expect(types.size).toBe(3);
		});
	});

	// ── suggest — edge cases ────────────────────────────────────────

	describe("suggest — deduplication and ordering", () => {
		it("deduplicates case variants in suggestions", async () => {
			await controller.recordQuery("Red T-Shirt", 5);
			await controller.recordQuery("red t-shirt", 3);
			await controller.indexItem({
				entityType: "product",
				entityId: "p1",
				title: "red t-shirt",
				url: "/p/red",
			});

			const suggestions = await controller.suggest("red");
			// Should not contain duplicates of the same normalized term
			const normalized = suggestions.map((s) => s.toLowerCase().trim());
			expect(new Set(normalized).size).toBe(normalized.length);
		});

		it("returns title suggestions when no queries match", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "p1",
				title: "Green Hat",
				url: "/p/green",
			});

			const suggestions = await controller.suggest("green");
			expect(suggestions).toHaveLength(1);
			expect(suggestions[0]).toBe("Green Hat");
		});

		it("excludes zero-result queries from suggestions", async () => {
			await controller.recordQuery("red nothing", 0);
			await controller.recordQuery("red shoes", 5);

			const suggestions = await controller.suggest("red");
			expect(suggestions).not.toContain("red nothing");
		});
	});

	// ── getRecentQueries — ordering ─────────────────────────────────

	describe("getRecentQueries — ordering", () => {
		it("returns most recent first", async () => {
			await controller.recordQuery("first", 10, "sess_order");
			await new Promise((r) => setTimeout(r, 5));
			await controller.recordQuery("second", 5, "sess_order");
			await new Promise((r) => setTimeout(r, 5));
			await controller.recordQuery("third", 3, "sess_order");

			const recent = await controller.getRecentQueries("sess_order");
			expect(recent[0].term).toBe("third");
			expect(recent[recent.length - 1].term).toBe("first");
		});

		it("ignores queries from other sessions", async () => {
			await controller.recordQuery("mine", 10, "sess_a");
			await controller.recordQuery("not_mine", 5, "sess_b");

			const recent = await controller.getRecentQueries("sess_a");
			expect(recent).toHaveLength(1);
			expect(recent[0].term).toBe("mine");
		});
	});

	// ── getAnalytics — edge cases ───────────────────────────────────

	describe("getAnalytics — edge cases", () => {
		it("100% zero-result rate when all queries have zero results", async () => {
			await controller.recordQuery("missing1", 0);
			await controller.recordQuery("missing2", 0);
			await controller.recordQuery("missing3", 0);

			const analytics = await controller.getAnalytics();
			expect(analytics.zeroResultRate).toBe(100);
			expect(analytics.avgResultCount).toBe(0);
			expect(analytics.totalQueries).toBe(3);
		});

		it("unique terms count is correct with repeated queries", async () => {
			await controller.recordQuery("shoes", 10);
			await controller.recordQuery("shoes", 8);
			await controller.recordQuery("Shoes", 12); // same normalized term
			await controller.recordQuery("hats", 5);

			const analytics = await controller.getAnalytics();
			expect(analytics.uniqueTerms).toBe(2);
			expect(analytics.totalQueries).toBe(4);
		});
	});

	// ── synonyms — search integration ───────────────────────────────

	describe("synonyms — bidirectional expansion", () => {
		it("searching a synonym finds items indexed with the original term", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "sneaker_1",
				title: "Running Sneakers",
				url: "/products/sneakers",
			});
			await controller.addSynonym("sneaker", ["shoe", "trainer", "footwear"]);

			const { results } = await controller.search("shoe");
			expect(results.length).toBeGreaterThan(0);
		});

		it("searching the original term finds items indexed with synonym text", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "shoe_1",
				title: "Leather Shoe",
				url: "/products/shoe",
			});
			await controller.addSynonym("sneaker", ["shoe", "trainer", "footwear"]);

			const { results } = await controller.search("sneaker");
			const ids = results.map((r) => r.item.entityId);
			expect(ids).toContain("shoe_1");
		});

		it("removing a synonym stops expansion", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "hat_1",
				title: "Fedora Hat",
				url: "/products/fedora",
			});
			const syn = await controller.addSynonym("cap", ["hat", "beanie"]);

			// Before removal — should find via synonym
			const { results: before } = await controller.search("cap");
			expect(before.length).toBeGreaterThan(0);

			// Remove and re-search
			await controller.removeSynonym(syn.id);
			const { results: after } = await controller.search("cap");
			// "cap" no longer expands to "hat"
			expect(after).toHaveLength(0);
		});
	});

	// ── getPopularTerms — tie-breaking ──────────────────────────────

	describe("getPopularTerms — tie-breaking", () => {
		it("terms with equal count are both returned", async () => {
			await controller.recordQuery("shoes", 10);
			await controller.recordQuery("shoes", 8);
			await controller.recordQuery("hats", 5);
			await controller.recordQuery("hats", 3);

			const popular = await controller.getPopularTerms();
			expect(popular).toHaveLength(2);
			expect(popular[0].count).toBe(2);
			expect(popular[1].count).toBe(2);
		});

		it("avgResultCount rounds correctly", async () => {
			await controller.recordQuery("shoes", 10);
			await controller.recordQuery("shoes", 11);

			const popular = await controller.getPopularTerms();
			expect(popular[0].avgResultCount).toBe(11); // Math.round(21/2) = 11
		});
	});

	// ── removeFromIndex — multiple items ────────────────────────────

	describe("removeFromIndex — comprehensive", () => {
		it("removes only the targeted entity, not others of same type", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "keep_me",
				title: "Keeper",
				url: "/p/keep",
			});
			await controller.indexItem({
				entityType: "product",
				entityId: "delete_me",
				title: "Doomed",
				url: "/p/delete",
			});

			await controller.removeFromIndex("product", "delete_me");
			expect(await controller.getIndexCount()).toBe(1);

			const { results } = await controller.search("Keeper");
			expect(results).toHaveLength(1);
		});
	});
});

describe("search controllers — additional coverage", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSearchController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSearchController(mockData);
	});

	// ── getZeroResultQueries ───────────────────────────────────────

	describe("getZeroResultQueries", () => {
		it("returns only queries that had zero results", async () => {
			await controller.recordQuery("found shoes", 10);
			await controller.recordQuery("missing widget", 0);
			await controller.recordQuery("no results term", 0);
			await controller.recordQuery("another hit", 5);

			const zeroQueries = await controller.getZeroResultQueries();
			expect(zeroQueries).toHaveLength(2);
			const terms = zeroQueries.map((q) => q.term);
			expect(terms).toContain("missing widget");
			expect(terms).toContain("no results term");
		});

		it("aggregates repeated zero-result queries by normalized term", async () => {
			await controller.recordQuery("missing widget", 0);
			await controller.recordQuery("Missing Widget", 0);
			await controller.recordQuery("MISSING WIDGET", 0);
			await controller.recordQuery("other miss", 0);

			const zeroQueries = await controller.getZeroResultQueries();
			expect(zeroQueries).toHaveLength(2);
			const widgetEntry = zeroQueries.find(
				(q) => q.term.toLowerCase() === "missing widget",
			);
			expect(widgetEntry).toBeDefined();
			expect(widgetEntry?.count).toBe(3);
		});

		it("sorts by count descending", async () => {
			await controller.recordQuery("rare miss", 0);
			await controller.recordQuery("common miss", 0);
			await controller.recordQuery("common miss", 0);
			await controller.recordQuery("common miss", 0);
			await controller.recordQuery("medium miss", 0);
			await controller.recordQuery("medium miss", 0);

			const zeroQueries = await controller.getZeroResultQueries();
			expect(zeroQueries[0].count).toBe(3);
			expect(zeroQueries[1].count).toBe(2);
			expect(zeroQueries[2].count).toBe(1);
		});

		it("respects custom limit", async () => {
			await controller.recordQuery("miss_a", 0);
			await controller.recordQuery("miss_b", 0);
			await controller.recordQuery("miss_c", 0);
			await controller.recordQuery("miss_d", 0);
			await controller.recordQuery("miss_e", 0);

			const limited = await controller.getZeroResultQueries(2);
			expect(limited).toHaveLength(2);
		});

		it("uses default limit of 20", async () => {
			for (let i = 0; i < 25; i++) {
				await controller.recordQuery(`miss_${i}`, 0);
			}
			const result = await controller.getZeroResultQueries();
			expect(result).toHaveLength(20);
		});

		it("returns empty array when no queries have zero results", async () => {
			await controller.recordQuery("good query", 5);
			await controller.recordQuery("another good one", 12);

			const zeroQueries = await controller.getZeroResultQueries();
			expect(zeroQueries).toHaveLength(0);
		});

		it("returns empty array when no queries exist at all", async () => {
			const zeroQueries = await controller.getZeroResultQueries();
			expect(zeroQueries).toHaveLength(0);
		});

		it("always reports avgResultCount as 0", async () => {
			await controller.recordQuery("miss1", 0);
			await controller.recordQuery("miss2", 0);

			const zeroQueries = await controller.getZeroResultQueries();
			for (const q of zeroQueries) {
				expect(q.avgResultCount).toBe(0);
			}
		});
	});

	// ── listSynonyms ───────────────────────────────────────────────

	describe("listSynonyms", () => {
		it("returns empty array when no synonyms defined", async () => {
			const synonyms = await controller.listSynonyms();
			expect(synonyms).toHaveLength(0);
		});

		it("returns all added synonyms", async () => {
			await controller.addSynonym("shoe", ["sneaker", "trainer"]);
			await controller.addSynonym("hat", ["cap", "beanie"]);
			await controller.addSynonym("pants", ["trousers", "jeans"]);

			const synonyms = await controller.listSynonyms();
			expect(synonyms).toHaveLength(3);
			const terms = synonyms.map((s) => s.term);
			expect(terms).toContain("shoe");
			expect(terms).toContain("hat");
			expect(terms).toContain("pants");
		});

		it("reflects removals", async () => {
			const s1 = await controller.addSynonym("shoe", ["sneaker"]);
			await controller.addSynonym("hat", ["cap"]);

			await controller.removeSynonym(s1.id);

			const synonyms = await controller.listSynonyms();
			expect(synonyms).toHaveLength(1);
			expect(synonyms[0].term).toBe("hat");
		});

		it("synonym entries have correct structure", async () => {
			await controller.addSynonym("shoe", ["sneaker", "trainer"]);

			const synonyms = await controller.listSynonyms();
			expect(synonyms[0]).toHaveProperty("id");
			expect(synonyms[0]).toHaveProperty("term", "shoe");
			expect(synonyms[0]).toHaveProperty("synonyms");
			expect(synonyms[0].synonyms).toEqual(["sneaker", "trainer"]);
			expect(synonyms[0]).toHaveProperty("createdAt");
		});
	});

	// ── search with skip/limit pagination ──────────────────────────

	describe("search — skip/limit pagination", () => {
		beforeEach(async () => {
			for (let i = 0; i < 10; i++) {
				await controller.indexItem({
					entityType: "product",
					entityId: `paginated_${i}`,
					title: `Alpha Item ${i}`,
					url: `/products/alpha-${i}`,
				});
			}
		});

		it("limits results to specified limit", async () => {
			const { results, total } = await controller.search("alpha", {
				limit: 3,
			});
			expect(results).toHaveLength(3);
			expect(total).toBe(10);
		});

		it("skips the specified number of results", async () => {
			const { results: allResults } = await controller.search("alpha");
			const { results: skipped } = await controller.search("alpha", {
				skip: 3,
			});

			// Skipped results should not include the first 3
			expect(skipped[0].item.entityId).toBe(allResults[3].item.entityId);
		});

		it("combines skip and limit correctly", async () => {
			const { results: allResults, total: allTotal } =
				await controller.search("alpha");
			const { results: page, total } = await controller.search("alpha", {
				skip: 2,
				limit: 3,
			});

			expect(page).toHaveLength(3);
			expect(total).toBe(allTotal);
			expect(page[0].item.entityId).toBe(allResults[2].item.entityId);
			expect(page[2].item.entityId).toBe(allResults[4].item.entityId);
		});

		it("returns fewer results when skip + limit exceeds total", async () => {
			const { results, total } = await controller.search("alpha", {
				skip: 8,
				limit: 5,
			});
			expect(results).toHaveLength(2);
			expect(total).toBe(10);
		});

		it("returns empty results when skip exceeds total", async () => {
			const { results, total } = await controller.search("alpha", {
				skip: 100,
			});
			expect(results).toHaveLength(0);
			expect(total).toBe(10);
		});

		it("defaults limit to 20 and skip to 0", async () => {
			const { results } = await controller.search("alpha");
			expect(results).toHaveLength(10); // Only 10 items exist, well under default 20
		});

		it("returns correct total when paginated with entityType filter", async () => {
			await controller.indexItem({
				entityType: "blog",
				entityId: "blog_alpha",
				title: "Alpha Blog Post",
				url: "/blog/alpha",
			});

			const { results, total } = await controller.search("alpha", {
				entityType: "product",
				limit: 3,
			});
			expect(results).toHaveLength(3);
			expect(total).toBe(10); // only products
		});
	});

	// ── suggest with custom limit ──────────────────────────────────

	describe("suggest — custom limit", () => {
		beforeEach(async () => {
			for (let i = 0; i < 15; i++) {
				await controller.recordQuery(`test query ${i}`, i + 1);
			}
		});

		it("defaults to limit of 10", async () => {
			const suggestions = await controller.suggest("test");
			expect(suggestions.length).toBeLessThanOrEqual(10);
		});

		it("respects custom limit of 3", async () => {
			const suggestions = await controller.suggest("test", 3);
			expect(suggestions.length).toBeLessThanOrEqual(3);
		});

		it("returns fewer than limit when not enough matches exist", async () => {
			const suggestions = await controller.suggest("test query 1", 50);
			// Only items starting with "test query 1" match: "test query 1", "test query 10"..."test query 14"
			expect(suggestions.length).toBeLessThan(50);
			expect(suggestions.length).toBeGreaterThan(0);
		});

		it("returns empty for no prefix match", async () => {
			const suggestions = await controller.suggest("zzznotfound", 5);
			expect(suggestions).toHaveLength(0);
		});

		it("limit of 1 returns only top suggestion", async () => {
			const suggestions = await controller.suggest("test", 1);
			expect(suggestions).toHaveLength(1);
		});

		it("includes title suggestions when limit allows", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "title_suggest",
				title: "Test Product Supreme",
				url: "/p/test-supreme",
			});

			const suggestions = await controller.suggest("test", 20);
			expect(suggestions).toContain("Test Product Supreme");
		});
	});

	// ── removeFromIndex — non-existent entity ──────────────────────

	describe("removeFromIndex — non-existent entity", () => {
		it("returns false when entity does not exist", async () => {
			const result = await controller.removeFromIndex(
				"product",
				"nonexistent_id",
			);
			expect(result).toBe(false);
		});

		it("returns false for wrong entityType with existing entityId", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "real_id",
				title: "Real Product",
				url: "/p/real",
			});

			const result = await controller.removeFromIndex("blog", "real_id");
			expect(result).toBe(false);
			// Original item should still exist
			expect(await controller.getIndexCount()).toBe(1);
		});

		it("returns true when entity exists and is removed", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "to_remove",
				title: "Removable",
				url: "/p/remove",
			});

			const result = await controller.removeFromIndex("product", "to_remove");
			expect(result).toBe(true);
			expect(await controller.getIndexCount()).toBe(0);
		});

		it("returns false on second removal of same entity", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "once",
				title: "Once",
				url: "/p/once",
			});

			await controller.removeFromIndex("product", "once");
			const secondRemoval = await controller.removeFromIndex("product", "once");
			expect(secondRemoval).toBe(false);
		});
	});

	// ── addSynonym — update existing ───────────────────────────────

	describe("addSynonym — updating existing synonym", () => {
		it("updates synonyms for an existing normalized term", async () => {
			const first = await controller.addSynonym("shoe", ["sneaker", "trainer"]);
			const updated = await controller.addSynonym("shoe", [
				"boot",
				"sandal",
				"slipper",
			]);

			expect(updated.id).toBe(first.id);
			expect(updated.synonyms).toEqual(["boot", "sandal", "slipper"]);
		});

		it("preserves createdAt when updating", async () => {
			const first = await controller.addSynonym("shoe", ["sneaker"]);
			await new Promise((r) => setTimeout(r, 5));
			const updated = await controller.addSynonym("shoe", ["boot"]);

			expect(updated.createdAt).toEqual(first.createdAt);
		});

		it("does not create duplicate synonym entries", async () => {
			await controller.addSynonym("shoe", ["sneaker"]);
			await controller.addSynonym("shoe", ["boot"]);
			await controller.addSynonym("shoe", ["sandal"]);

			const synonyms = await controller.listSynonyms();
			const shoeEntries = synonyms.filter((s) => s.term === "shoe");
			expect(shoeEntries).toHaveLength(1);
		});

		it("treats term case-insensitively for dedup", async () => {
			const first = await controller.addSynonym("Shoe", ["sneaker"]);
			const second = await controller.addSynonym("shoe", ["boot"]);

			// Both normalize to "shoe" so they should share the same ID
			expect(second.id).toBe(first.id);
		});

		it("trims whitespace from synonym values", async () => {
			const syn = await controller.addSynonym("shoe", [
				"  sneaker  ",
				"trainer  ",
				"  boot",
			]);
			expect(syn.synonyms).toEqual(["sneaker", "trainer", "boot"]);
		});
	});

	// ── recordQuery — normalized term storage ──────────────────────

	describe("recordQuery — normalized term storage", () => {
		it("stores lowercase normalized term", async () => {
			const query = await controller.recordQuery("Red SHOES", 5);
			expect(query.normalizedTerm).toBe("red shoes");
		});

		it("trims and collapses whitespace in normalized term", async () => {
			const query = await controller.recordQuery("  red    shoes  ", 5);
			expect(query.normalizedTerm).toBe("red shoes");
		});

		it("preserves original term as-is", async () => {
			const query = await controller.recordQuery("  Red SHOES  ", 5);
			expect(query.term).toBe("  Red SHOES  ");
		});

		it("stores resultCount correctly", async () => {
			const q = await controller.recordQuery("test", 42);
			expect(q.resultCount).toBe(42);
		});

		it("stores zero resultCount", async () => {
			const q = await controller.recordQuery("nothing", 0);
			expect(q.resultCount).toBe(0);
		});

		it("stores sessionId when provided", async () => {
			const q = await controller.recordQuery("test", 5, "sess_123");
			expect(q.sessionId).toBe("sess_123");
		});

		it("sessionId is undefined when not provided", async () => {
			const q = await controller.recordQuery("test", 5);
			expect(q.sessionId).toBeUndefined();
		});

		it("generates unique IDs for each recorded query", async () => {
			const q1 = await controller.recordQuery("test", 5);
			const q2 = await controller.recordQuery("test", 5);
			expect(q1.id).not.toBe(q2.id);
		});

		it("sets searchedAt timestamp", async () => {
			const before = new Date();
			const q = await controller.recordQuery("test", 5);
			const after = new Date();

			expect(new Date(q.searchedAt).getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(new Date(q.searchedAt).getTime()).toBeLessThanOrEqual(
				after.getTime(),
			);
		});
	});

	// ── getRecentQueries — custom limit ────────────────────────────

	describe("getRecentQueries — custom limit", () => {
		beforeEach(async () => {
			for (let i = 0; i < 15; i++) {
				await controller.recordQuery(`query_${i}`, i, "sess_limit");
				await new Promise((r) => setTimeout(r, 2));
			}
		});

		it("defaults to limit of 10", async () => {
			const recent = await controller.getRecentQueries("sess_limit");
			expect(recent).toHaveLength(10);
		});

		it("respects custom limit of 5", async () => {
			const recent = await controller.getRecentQueries("sess_limit", 5);
			expect(recent).toHaveLength(5);
		});

		it("returns all when limit exceeds available", async () => {
			const recent = await controller.getRecentQueries("sess_limit", 50);
			expect(recent).toHaveLength(15);
		});

		it("limit of 1 returns only most recent", async () => {
			const recent = await controller.getRecentQueries("sess_limit", 1);
			expect(recent).toHaveLength(1);
			expect(recent[0].term).toBe("query_14");
		});

		it("deduplicates by normalized term keeping most recent", async () => {
			await controller.recordQuery("Shoes", 5, "sess_dedup");
			await new Promise((r) => setTimeout(r, 2));
			await controller.recordQuery("shoes", 8, "sess_dedup");
			await new Promise((r) => setTimeout(r, 2));
			await controller.recordQuery("SHOES", 3, "sess_dedup");

			const recent = await controller.getRecentQueries("sess_dedup");
			const shoeEntries = recent.filter((q) => q.normalizedTerm === "shoes");
			expect(shoeEntries).toHaveLength(1);
			expect(shoeEntries[0].term).toBe("SHOES"); // most recent
		});
	});

	// ── getAnalytics — mixed results ───────────────────────────────

	describe("getAnalytics — mixed results", () => {
		it("calculates correct stats with mixed zero and non-zero results", async () => {
			await controller.recordQuery("found_a", 10);
			await controller.recordQuery("found_b", 20);
			await controller.recordQuery("miss_a", 0);
			await controller.recordQuery("miss_b", 0);

			const analytics = await controller.getAnalytics();
			expect(analytics.totalQueries).toBe(4);
			expect(analytics.uniqueTerms).toBe(4);
			expect(analytics.zeroResultCount).toBe(2);
			expect(analytics.zeroResultRate).toBe(50);
			expect(analytics.avgResultCount).toBe(8); // Math.round(30/4) = 8
		});

		it("calculates zeroResultRate with uneven splits", async () => {
			await controller.recordQuery("hit1", 5);
			await controller.recordQuery("hit2", 10);
			await controller.recordQuery("miss1", 0);

			const analytics = await controller.getAnalytics();
			expect(analytics.zeroResultRate).toBe(33); // Math.round(1/3 * 100) = 33
		});

		it("returns all zeros when no queries recorded", async () => {
			const analytics = await controller.getAnalytics();
			expect(analytics.totalQueries).toBe(0);
			expect(analytics.uniqueTerms).toBe(0);
			expect(analytics.avgResultCount).toBe(0);
			expect(analytics.zeroResultCount).toBe(0);
			expect(analytics.zeroResultRate).toBe(0);
		});

		it("0% zero-result rate when all queries have results", async () => {
			await controller.recordQuery("good1", 5);
			await controller.recordQuery("good2", 10);
			await controller.recordQuery("good3", 1);

			const analytics = await controller.getAnalytics();
			expect(analytics.zeroResultRate).toBe(0);
			expect(analytics.zeroResultCount).toBe(0);
		});

		it("counts repeated normalized terms as one unique term", async () => {
			await controller.recordQuery("shoes", 10);
			await controller.recordQuery("shoes", 0);
			await controller.recordQuery("SHOES", 5);
			await controller.recordQuery("hats", 3);
			await controller.recordQuery("hats", 0);

			const analytics = await controller.getAnalytics();
			expect(analytics.totalQueries).toBe(5);
			expect(analytics.uniqueTerms).toBe(2);
			expect(analytics.zeroResultCount).toBe(2);
			expect(analytics.zeroResultRate).toBe(40); // 2/5 * 100 = 40
			expect(analytics.avgResultCount).toBe(4); // Math.round(18/5) = 4
		});

		it("handles single query with zero results", async () => {
			await controller.recordQuery("lonely miss", 0);

			const analytics = await controller.getAnalytics();
			expect(analytics.totalQueries).toBe(1);
			expect(analytics.uniqueTerms).toBe(1);
			expect(analytics.avgResultCount).toBe(0);
			expect(analytics.zeroResultCount).toBe(1);
			expect(analytics.zeroResultRate).toBe(100);
		});

		it("handles single query with results", async () => {
			await controller.recordQuery("lonely hit", 7);

			const analytics = await controller.getAnalytics();
			expect(analytics.totalQueries).toBe(1);
			expect(analytics.uniqueTerms).toBe(1);
			expect(analytics.avgResultCount).toBe(7);
			expect(analytics.zeroResultCount).toBe(0);
			expect(analytics.zeroResultRate).toBe(0);
		});
	});

	// ── search — total accuracy when paginated ─────────────────────

	describe("search — total reflects all matches regardless of pagination", () => {
		beforeEach(async () => {
			for (let i = 0; i < 8; i++) {
				await controller.indexItem({
					entityType: "product",
					entityId: `beta_${i}`,
					title: `Beta Widget ${i}`,
					url: `/products/beta-${i}`,
				});
			}
		});

		it("total is consistent across different skip values", async () => {
			const { total: t1 } = await controller.search("beta", { skip: 0 });
			const { total: t2 } = await controller.search("beta", { skip: 3 });
			const { total: t3 } = await controller.search("beta", { skip: 7 });
			const { total: t4 } = await controller.search("beta", { skip: 100 });

			expect(t1).toBe(8);
			expect(t2).toBe(8);
			expect(t3).toBe(8);
			expect(t4).toBe(8);
		});

		it("total is consistent across different limit values", async () => {
			const { total: t1 } = await controller.search("beta", { limit: 1 });
			const { total: t2 } = await controller.search("beta", { limit: 5 });
			const { total: t3 } = await controller.search("beta", { limit: 100 });

			expect(t1).toBe(8);
			expect(t2).toBe(8);
			expect(t3).toBe(8);
		});

		it("paginating through all results yields complete set", async () => {
			const allIds = new Set<string>();
			let skip = 0;
			const limit = 3;

			while (true) {
				const { results, total } = await controller.search("beta", {
					skip,
					limit,
				});
				expect(total).toBe(8);
				if (results.length === 0) break;
				for (const r of results) {
					allIds.add(r.item.entityId);
				}
				skip += limit;
			}

			expect(allIds.size).toBe(8);
		});

		it("no duplicate items across pages", async () => {
			const page1 = await controller.search("beta", { skip: 0, limit: 4 });
			const page2 = await controller.search("beta", { skip: 4, limit: 4 });

			const page1Ids = page1.results.map((r) => r.item.entityId);
			const page2Ids = page2.results.map((r) => r.item.entityId);

			for (const id of page1Ids) {
				expect(page2Ids).not.toContain(id);
			}
		});
	});
});
