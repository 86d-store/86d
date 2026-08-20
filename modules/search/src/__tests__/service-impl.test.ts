import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSearchController } from "../service-impl";

describe("createSearchController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createSearchController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createSearchController(mockData);
	});

	// ── indexItem ────────────────────────────────────────────────────────

	describe("indexItem", () => {
		it("indexes a new item", async () => {
			const item = await controller.indexItem({
				entityType: "product",
				entityId: "prod_1",
				title: "Red T-Shirt",
				body: "A comfortable cotton t-shirt in red",
				tags: ["clothing", "t-shirt", "red"],
				url: "/products/red-t-shirt",
				image: "/images/red-tshirt.jpg",
			});
			expect(item.id).toBeDefined();
			expect(item.entityType).toBe("product");
			expect(item.entityId).toBe("prod_1");
			expect(item.title).toBe("Red T-Shirt");
			expect(item.tags).toEqual(["clothing", "t-shirt", "red"]);
			expect(item.indexedAt).toBeInstanceOf(Date);
		});

		it("updates an existing indexed item", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "prod_1",
				title: "Red T-Shirt",
				url: "/products/red-t-shirt",
			});
			const updated = await controller.indexItem({
				entityType: "product",
				entityId: "prod_1",
				title: "Updated Red T-Shirt",
				url: "/products/red-t-shirt",
			});
			expect(updated.title).toBe("Updated Red T-Shirt");

			const count = await controller.getIndexCount();
			expect(count).toBe(1);
		});

		it("defaults tags and metadata", async () => {
			const item = await controller.indexItem({
				entityType: "blog",
				entityId: "post_1",
				title: "Hello World",
				url: "/blog/hello-world",
			});
			expect(item.tags).toEqual([]);
			expect(item.metadata).toEqual({});
		});
	});

	// ── bulkIndex ────────────────────────────────────────────────────────

	describe("bulkIndex", () => {
		it("indexes multiple items at once", async () => {
			const result = await controller.bulkIndex([
				{
					entityType: "product",
					entityId: "p1",
					title: "Item 1",
					url: "/p1",
				},
				{
					entityType: "product",
					entityId: "p2",
					title: "Item 2",
					url: "/p2",
				},
				{
					entityType: "product",
					entityId: "p3",
					title: "Item 3",
					url: "/p3",
				},
			]);
			expect(result.indexed).toBe(3);
			expect(result.errors).toBe(0);
			const count = await controller.getIndexCount();
			expect(count).toBe(3);
		});

		it("updates existing items in bulk", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "p1",
				title: "Old Title",
				url: "/p1",
			});
			const result = await controller.bulkIndex([
				{
					entityType: "product",
					entityId: "p1",
					title: "New Title",
					url: "/p1",
				},
				{
					entityType: "product",
					entityId: "p2",
					title: "Item 2",
					url: "/p2",
				},
			]);
			expect(result.indexed).toBe(2);
			expect(result.errors).toBe(0);
			const count = await controller.getIndexCount();
			expect(count).toBe(2);
		});
	});

	// ── removeFromIndex ─────────────────────────────────────────────────

	describe("removeFromIndex", () => {
		it("removes an indexed item", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "prod_1",
				title: "Red T-Shirt",
				url: "/products/red-t-shirt",
			});
			const removed = await controller.removeFromIndex("product", "prod_1");
			expect(removed).toBe(true);
			const count = await controller.getIndexCount();
			expect(count).toBe(0);
		});

		it("returns false for non-existent item", async () => {
			const removed = await controller.removeFromIndex("product", "missing");
			expect(removed).toBe(false);
		});
	});

	// ── search ──────────────────────────────────────────────────────────

	describe("search", () => {
		beforeEach(async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "prod_1",
				title: "Red T-Shirt",
				body: "Comfortable cotton t-shirt",
				tags: ["clothing", "red"],
				url: "/products/red-t-shirt",
			});
			await controller.indexItem({
				entityType: "product",
				entityId: "prod_2",
				title: "Blue Jeans",
				body: "Classic denim jeans",
				tags: ["clothing", "blue", "denim"],
				url: "/products/blue-jeans",
			});
			await controller.indexItem({
				entityType: "blog",
				entityId: "post_1",
				title: "How to Style T-Shirts",
				body: "Tips for styling your favorite t-shirts",
				tags: ["fashion", "tips"],
				url: "/blog/style-t-shirts",
			});
		});

		it("returns matching results sorted by score", async () => {
			const { results, total } = await controller.search("t-shirt");
			expect(total).toBeGreaterThan(0);
			expect(results[0].item.title).toContain("T-Shirt");
			expect(results[0].score).toBeGreaterThan(0);
		});

		it("returns empty results for non-matching query", async () => {
			const { results, total } = await controller.search("nonexistent", {
				fuzzy: false,
			});
			expect(results).toHaveLength(0);
			expect(total).toBe(0);
		});

		it("returns empty results for empty query", async () => {
			const { results, total } = await controller.search("  ");
			expect(results).toHaveLength(0);
			expect(total).toBe(0);
		});

		it("filters by entityType", async () => {
			const { results } = await controller.search("t-shirt", {
				entityType: "product",
			});
			for (const r of results) {
				expect(r.item.entityType).toBe("product");
			}
		});

		it("supports pagination with limit and skip", async () => {
			const { results: page1 } = await controller.search("clothing", {
				limit: 1,
				skip: 0,
			});
			const { results: page2 } = await controller.search("clothing", {
				limit: 1,
				skip: 1,
			});
			expect(page1).toHaveLength(1);
			if (page2.length > 0) {
				expect(page1[0].item.id).not.toBe(page2[0].item.id);
			}
		});

		it("matches on tags", async () => {
			const { results } = await controller.search("denim");
			expect(results.length).toBeGreaterThan(0);
			expect(results[0].item.entityId).toBe("prod_2");
		});

		it("matches on body content", async () => {
			const { results } = await controller.search("cotton");
			expect(results.length).toBeGreaterThan(0);
			expect(results[0].item.entityId).toBe("prod_1");
		});

		it("ranks title matches higher than body matches", async () => {
			const { results } = await controller.search("red");
			expect(results.length).toBeGreaterThan(0);
			expect(results[0].item.entityId).toBe("prod_1");
		});

		it("returns facets with results", async () => {
			const { facets } = await controller.search("clothing");
			expect(facets.entityTypes.length).toBeGreaterThan(0);
			expect(facets.entityTypes[0].type).toBe("product");
			expect(facets.tags.length).toBeGreaterThan(0);
		});

		it("returns highlights in results", async () => {
			const { results } = await controller.search("red");
			expect(results.length).toBeGreaterThan(0);
			const highlight = results[0].highlights;
			expect(highlight?.title).toContain("<mark>");
		});
	});

	// ── fuzzy search ───────────────────────────────────────────────────

	describe("fuzzy search", () => {
		beforeEach(async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "prod_1",
				title: "Running Shoes",
				tags: ["footwear", "athletic"],
				url: "/products/running-shoes",
			});
			await controller.indexItem({
				entityType: "product",
				entityId: "prod_2",
				title: "Leather Boots",
				tags: ["footwear", "winter"],
				url: "/products/leather-boots",
			});
		});

		it("finds results with typos when fuzzy is enabled", async () => {
			const { results } = await controller.search("runnign", {
				fuzzy: true,
			});
			expect(results.length).toBeGreaterThan(0);
			expect(results[0].item.entityId).toBe("prod_1");
		});

		it("does not find typo results when fuzzy is disabled", async () => {
			const { results } = await controller.search("runnign", {
				fuzzy: false,
			});
			expect(results).toHaveLength(0);
		});

		it("fuzzy matches short words only with exact match", async () => {
			// Words <= 3 chars get no fuzzy tolerance
			const { results } = await controller.search("ren", {
				fuzzy: true,
			});
			// "ren" is too short for fuzzy to match "run" (distance 2)
			expect(results).toHaveLength(0);
		});

		it("fuzzy matches medium words with 1 edit distance", async () => {
			const { results } = await controller.search("shoez", {
				fuzzy: true,
			});
			expect(results.length).toBeGreaterThan(0);
		});

		it("fuzzy matches longer words with 2 edit distance", async () => {
			const { results } = await controller.search("leathor", {
				fuzzy: true,
			});
			expect(results.length).toBeGreaterThan(0);
		});
	});

	// ── tag filtering ──────────────────────────────────────────────────

	describe("tag filtering", () => {
		beforeEach(async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "p1",
				title: "Red Sneakers",
				tags: ["shoes", "red", "sport"],
				url: "/p1",
			});
			await controller.indexItem({
				entityType: "product",
				entityId: "p2",
				title: "Red Jacket",
				tags: ["outerwear", "red", "winter"],
				url: "/p2",
			});
			await controller.indexItem({
				entityType: "product",
				entityId: "p3",
				title: "Blue Sneakers",
				tags: ["shoes", "blue", "sport"],
				url: "/p3",
			});
		});

		it("filters results by tags", async () => {
			const { results } = await controller.search("sneakers", {
				tags: ["red"],
			});
			expect(results).toHaveLength(1);
			expect(results[0].item.entityId).toBe("p1");
		});

		it("returns all matching results without tag filter", async () => {
			const { results } = await controller.search("red");
			expect(results.length).toBeGreaterThanOrEqual(2);
		});

		it("returns empty when no items match tag filter", async () => {
			const { results } = await controller.search("sneakers", {
				tags: ["winter"],
			});
			expect(results).toHaveLength(0);
		});
	});

	// ── sorting ────────────────────────────────────────────────────────

	describe("sorting", () => {
		beforeEach(async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "p1",
				title: "Alpha Widget",
				tags: ["widget"],
				url: "/p1",
			});
			// Add a small delay to ensure different timestamps
			await controller.indexItem({
				entityType: "product",
				entityId: "p2",
				title: "Beta Widget",
				tags: ["widget"],
				url: "/p2",
			});
			await controller.indexItem({
				entityType: "product",
				entityId: "p3",
				title: "Charlie Widget",
				tags: ["widget"],
				url: "/p3",
			});
		});

		it("sorts by title ascending", async () => {
			const { results } = await controller.search("widget", {
				sort: "title_asc",
			});
			expect(results[0].item.title).toBe("Alpha Widget");
			expect(results[results.length - 1].item.title).toBe("Charlie Widget");
		});

		it("sorts by title descending", async () => {
			const { results } = await controller.search("widget", {
				sort: "title_desc",
			});
			expect(results[0].item.title).toBe("Charlie Widget");
			expect(results[results.length - 1].item.title).toBe("Alpha Widget");
		});

		it("defaults to relevance sorting", async () => {
			const { results } = await controller.search("widget");
			// All have same relevance, so order is stable
			expect(results.length).toBe(3);
		});
	});

	// ── did-you-mean ───────────────────────────────────────────────────

	describe("did-you-mean", () => {
		beforeEach(async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "p1",
				title: "Running Shoes",
				url: "/p1",
			});
			await controller.indexItem({
				entityType: "product",
				entityId: "p2",
				title: "Leather Boots",
				url: "/p2",
			});
		});

		it("suggests correction for misspelled query with zero results", async () => {
			// "bootes" is close to "boots" (dist 1), won't substring-match "Running Shoes"
			const { didYouMean } = await controller.search("bootes", {
				fuzzy: false,
			});
			expect(didYouMean).toBeDefined();
			expect(didYouMean).toBe("boots");
		});

		it("does not suggest correction when results are found", async () => {
			const { didYouMean } = await controller.search("running");
			expect(didYouMean).toBeUndefined();
		});
	});

	// ── synonym expansion ───────────────────────────────────────────────

	describe("search with synonyms", () => {
		beforeEach(async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "prod_1",
				title: "T-Shirt",
				url: "/products/t-shirt",
			});
			await controller.addSynonym("tee", ["t-shirt", "tshirt"]);
		});

		it("expands query with synonyms", async () => {
			const { results } = await controller.search("tee");
			expect(results.length).toBeGreaterThan(0);
			expect(results[0].item.entityId).toBe("prod_1");
		});

		it("also expands in reverse (synonym → term)", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "prod_2",
				title: "Tee Collection",
				url: "/products/tee-collection",
			});
			const { results } = await controller.search("tshirt");
			expect(results.length).toBeGreaterThan(0);
		});
	});

	// ── suggest ─────────────────────────────────────────────────────────

	describe("suggest", () => {
		beforeEach(async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "prod_1",
				title: "Red T-Shirt",
				url: "/products/red-t-shirt",
			});
			await controller.indexItem({
				entityType: "product",
				entityId: "prod_2",
				title: "Red Sneakers",
				url: "/products/red-sneakers",
			});
			await controller.recordQuery("red t-shirt", 5);
			await controller.recordQuery("red t-shirt", 3);
			await controller.recordQuery("red sneakers", 2);
		});

		it("returns suggestions matching prefix", async () => {
			const suggestions = await controller.suggest("red");
			expect(suggestions.length).toBeGreaterThan(0);
			for (const s of suggestions) {
				expect(s.toLowerCase()).toContain("red");
			}
		});

		it("prioritizes popular queries over title matches", async () => {
			const suggestions = await controller.suggest("red");
			expect(suggestions[0].toLowerCase()).toContain("red t-shirt");
		});

		it("respects limit", async () => {
			const suggestions = await controller.suggest("red", 1);
			expect(suggestions).toHaveLength(1);
		});

		it("returns empty for empty prefix", async () => {
			const suggestions = await controller.suggest("");
			expect(suggestions).toHaveLength(0);
		});
	});

	// ── recordQuery ─────────────────────────────────────────────────────

	describe("recordQuery", () => {
		it("records a search query", async () => {
			const query = await controller.recordQuery("red shoes", 10, "sess_1");
			expect(query.id).toBeDefined();
			expect(query.term).toBe("red shoes");
			expect(query.normalizedTerm).toBe("red shoes");
			expect(query.resultCount).toBe(10);
			expect(query.sessionId).toBe("sess_1");
			expect(query.searchedAt).toBeInstanceOf(Date);
		});

		it("records without sessionId", async () => {
			const query = await controller.recordQuery("blue hat", 5);
			expect(query.sessionId).toBeUndefined();
		});
	});

	// ── recordClick ─────────────────────────────────────────────────────

	describe("recordClick", () => {
		it("records a search result click", async () => {
			const query = await controller.recordQuery("shoes", 10, "sess_1");
			const click = await controller.recordClick({
				queryId: query.id,
				term: "shoes",
				entityType: "product",
				entityId: "prod_1",
				position: 0,
			});
			expect(click.id).toBeDefined();
			expect(click.queryId).toBe(query.id);
			expect(click.term).toBe("shoes");
			expect(click.position).toBe(0);
			expect(click.clickedAt).toBeInstanceOf(Date);
		});

		it("records multiple clicks for different positions", async () => {
			const query = await controller.recordQuery("shoes", 10);
			const click1 = await controller.recordClick({
				queryId: query.id,
				term: "shoes",
				entityType: "product",
				entityId: "prod_1",
				position: 0,
			});
			const click2 = await controller.recordClick({
				queryId: query.id,
				term: "shoes",
				entityType: "product",
				entityId: "prod_2",
				position: 1,
			});
			expect(click1.id).not.toBe(click2.id);
			expect(click1.position).toBe(0);
			expect(click2.position).toBe(1);
		});
	});

	// ── getRecentQueries ────────────────────────────────────────────────

	describe("getRecentQueries", () => {
		it("returns recent queries for a session", async () => {
			await controller.recordQuery("shoes", 10, "sess_1");
			await controller.recordQuery("hats", 5, "sess_1");
			await controller.recordQuery("bags", 3, "sess_2");

			const recent = await controller.getRecentQueries("sess_1");
			expect(recent).toHaveLength(2);
		});

		it("deduplicates by normalized term", async () => {
			await controller.recordQuery("Red Shoes", 10, "sess_1");
			await controller.recordQuery("red shoes", 8, "sess_1");

			const recent = await controller.getRecentQueries("sess_1");
			expect(recent).toHaveLength(1);
		});

		it("respects limit", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.recordQuery(`term_${i}`, i, "sess_1");
			}
			const recent = await controller.getRecentQueries("sess_1", 3);
			expect(recent).toHaveLength(3);
		});

		it("returns empty for unknown session", async () => {
			const recent = await controller.getRecentQueries("unknown");
			expect(recent).toHaveLength(0);
		});
	});

	// ── getPopularTerms ─────────────────────────────────────────────────

	describe("getPopularTerms", () => {
		it("returns terms sorted by frequency", async () => {
			await controller.recordQuery("shoes", 10);
			await controller.recordQuery("shoes", 8);
			await controller.recordQuery("shoes", 12);
			await controller.recordQuery("hats", 5);
			await controller.recordQuery("hats", 3);
			await controller.recordQuery("bags", 1);

			const popular = await controller.getPopularTerms();
			expect(popular[0].term).toBe("shoes");
			expect(popular[0].count).toBe(3);
			expect(popular[0].avgResultCount).toBe(10);
			expect(popular[1].term).toBe("hats");
			expect(popular[1].count).toBe(2);
		});

		it("respects limit", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.recordQuery(`term_${i}`, i);
			}
			const popular = await controller.getPopularTerms(5);
			expect(popular).toHaveLength(5);
		});

		it("returns empty when no queries", async () => {
			const popular = await controller.getPopularTerms();
			expect(popular).toHaveLength(0);
		});
	});

	// ── getZeroResultQueries ────────────────────────────────────────────

	describe("getZeroResultQueries", () => {
		it("returns only zero-result queries", async () => {
			await controller.recordQuery("existing", 10);
			await controller.recordQuery("missing", 0);
			await controller.recordQuery("missing", 0);
			await controller.recordQuery("also missing", 0);

			const zero = await controller.getZeroResultQueries();
			expect(zero).toHaveLength(2);
			expect(zero[0].term).toBe("missing");
			expect(zero[0].count).toBe(2);
			expect(zero[0].avgResultCount).toBe(0);
		});

		it("returns empty when all queries have results", async () => {
			await controller.recordQuery("shoes", 10);
			const zero = await controller.getZeroResultQueries();
			expect(zero).toHaveLength(0);
		});
	});

	// ── getAnalytics ────────────────────────────────────────────────────

	describe("getAnalytics", () => {
		it("returns analytics summary", async () => {
			await controller.recordQuery("shoes", 10);
			await controller.recordQuery("shoes", 8);
			await controller.recordQuery("hats", 0);

			const analytics = await controller.getAnalytics();
			expect(analytics.totalQueries).toBe(3);
			expect(analytics.uniqueTerms).toBe(2);
			expect(analytics.avgResultCount).toBe(6);
			expect(analytics.zeroResultCount).toBe(1);
			expect(analytics.zeroResultRate).toBe(33);
			expect(analytics.clickThroughRate).toBe(0);
			expect(analytics.avgClickPosition).toBe(0);
		});

		it("returns zeros when no queries", async () => {
			const analytics = await controller.getAnalytics();
			expect(analytics.totalQueries).toBe(0);
			expect(analytics.uniqueTerms).toBe(0);
			expect(analytics.avgResultCount).toBe(0);
			expect(analytics.zeroResultCount).toBe(0);
			expect(analytics.zeroResultRate).toBe(0);
			expect(analytics.clickThroughRate).toBe(0);
			expect(analytics.avgClickPosition).toBe(0);
		});

		it("computes click-through rate and avg position", async () => {
			const q1 = await controller.recordQuery("shoes", 10);
			const q2 = await controller.recordQuery("hats", 5);
			await controller.recordQuery("bags", 3);

			await controller.recordClick({
				queryId: q1.id,
				term: "shoes",
				entityType: "product",
				entityId: "p1",
				position: 0,
			});
			await controller.recordClick({
				queryId: q2.id,
				term: "hats",
				entityType: "product",
				entityId: "p2",
				position: 2,
			});

			const analytics = await controller.getAnalytics();
			// 2 queries with clicks out of 3 queries with results = 67%
			expect(analytics.clickThroughRate).toBe(67);
			// avg position: (0 + 2) / 2 = 1
			expect(analytics.avgClickPosition).toBe(1);
		});
	});

	// ── synonyms ────────────────────────────────────────────────────────

	describe("synonyms", () => {
		it("adds a synonym", async () => {
			const synonym = await controller.addSynonym("tee", ["t-shirt", "tshirt"]);
			expect(synonym.id).toBeDefined();
			expect(synonym.term).toBe("tee");
			expect(synonym.synonyms).toEqual(["t-shirt", "tshirt"]);
			expect(synonym.createdAt).toBeInstanceOf(Date);
		});

		it("updates existing synonym for same term", async () => {
			await controller.addSynonym("tee", ["t-shirt"]);
			const updated = await controller.addSynonym("tee", [
				"t-shirt",
				"tshirt",
				"shirt",
			]);
			expect(updated.synonyms).toEqual(["t-shirt", "tshirt", "shirt"]);

			const all = await controller.listSynonyms();
			expect(all).toHaveLength(1);
		});

		it("removes a synonym", async () => {
			const synonym = await controller.addSynonym("tee", ["t-shirt"]);
			const removed = await controller.removeSynonym(synonym.id);
			expect(removed).toBe(true);

			const all = await controller.listSynonyms();
			expect(all).toHaveLength(0);
		});

		it("returns false when removing non-existent synonym", async () => {
			const removed = await controller.removeSynonym("missing");
			expect(removed).toBe(false);
		});

		it("lists all synonyms", async () => {
			await controller.addSynonym("tee", ["t-shirt"]);
			await controller.addSynonym("sneaker", ["shoe", "trainer"]);

			const all = await controller.listSynonyms();
			expect(all).toHaveLength(2);
		});
	});

	// ── getIndexCount ───────────────────────────────────────────────────

	describe("getIndexCount", () => {
		it("returns 0 when empty", async () => {
			const count = await controller.getIndexCount();
			expect(count).toBe(0);
		});

		it("returns correct count", async () => {
			await controller.indexItem({
				entityType: "product",
				entityId: "prod_1",
				title: "Item 1",
				url: "/1",
			});
			await controller.indexItem({
				entityType: "product",
				entityId: "prod_2",
				title: "Item 2",
				url: "/2",
			});
			const count = await controller.getIndexCount();
			expect(count).toBe(2);
		});
	});
});
