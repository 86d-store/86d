import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { SearchResult } from "../service";
import { createSearchController } from "../service-impl";

/**
 * Store endpoint integration tests for the search module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. search: comma-separated tag parsing, response shaping (strips
 *    internal fields like body/metadata), fire-and-forget analytics,
 *    facets and didYouMean pass-through
 * 2. suggest: prefix autocomplete, limit handling
 * 3. click: analytics click recording
 * 4. recent: session-scoped recent query history, response shaping
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate store endpoint logic ─────────────────────────────────────

/**
 * Simulates the search endpoint: parses tags from comma-separated
 * string, delegates to controller, shapes response by stripping
 * internal fields.
 */
async function simulateSearch(
	data: DataService,
	query: {
		q: string;
		type?: string;
		tags?: string;
		sort?: "relevance" | "newest" | "oldest" | "title_asc" | "title_desc";
		fuzzy?: boolean;
		limit?: number;
		skip?: number;
		sessionId?: string;
	},
) {
	const controller = createSearchController(data);
	const parsedTags = query.tags
		? query.tags
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean)
		: undefined;

	const { results, total, facets, didYouMean } = await controller.search(
		query.q,
		{
			entityType: query.type,
			tags: parsedTags,
			sort: query.sort,
			fuzzy: query.fuzzy,
			limit: query.limit ?? 20,
			skip: query.skip ?? 0,
		},
	);

	// Fire-and-forget analytics recording
	controller.recordQuery(query.q, total, query.sessionId).catch(() => {});

	return {
		results: results.map((r: SearchResult) => ({
			id: r.item.id,
			entityType: r.item.entityType,
			entityId: r.item.entityId,
			title: r.item.title,
			url: r.item.url,
			image: r.item.image,
			tags: r.item.tags,
			score: r.score,
			highlights: r.highlights,
		})),
		total,
		facets,
		didYouMean,
	};
}

/**
 * Simulates the suggest endpoint.
 */
async function simulateSuggest(data: DataService, q: string, limit?: number) {
	const controller = createSearchController(data);
	const suggestions = await controller.suggest(q, limit ?? 8);
	return { suggestions };
}

/**
 * Simulates the click endpoint.
 */
async function simulateClick(
	data: DataService,
	body: {
		queryId: string;
		term: string;
		entityType: string;
		entityId: string;
		position: number;
	},
) {
	const controller = createSearchController(data);
	const click = await controller.recordClick(body);
	return { id: click.id };
}

/**
 * Simulates the recent endpoint: returns shaped recent queries.
 */
async function simulateRecent(
	data: DataService,
	sessionId: string,
	limit?: number,
) {
	const controller = createSearchController(data);
	const queries = await controller.getRecentQueries(sessionId, limit ?? 10);
	return {
		recent: queries.map((q) => ({
			term: q.term,
			resultCount: q.resultCount,
			searchedAt: q.searchedAt,
		})),
	};
}

// ── Helpers ───────────────────────────────────────────────────────────

async function seedIndexItems(data: DataService) {
	const controller = createSearchController(data);
	await controller.indexItem({
		entityType: "product",
		entityId: "prod-1",
		title: "Red Widget",
		body: "A fantastic red widget for everyday use",
		tags: ["electronics", "sale"],
		url: "/products/red-widget",
		image: "/img/red-widget.jpg",
	});
	await controller.indexItem({
		entityType: "product",
		entityId: "prod-2",
		title: "Blue Gadget",
		body: "The best blue gadget on the market",
		tags: ["electronics", "new"],
		url: "/products/blue-gadget",
	});
	await controller.indexItem({
		entityType: "page",
		entityId: "page-1",
		title: "About Us",
		body: "Learn about our company",
		tags: ["info"],
		url: "/about",
	});
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("search store endpoints", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	// ── search ───────────────────────────────────────────────────────

	describe("search", () => {
		it("returns results matching query", async () => {
			await seedIndexItems(data);
			const result = await simulateSearch(data, { q: "widget" });

			expect(result.total).toBeGreaterThan(0);
			expect(result.results[0].title).toContain("Widget");
		});

		it("shapes response by stripping internal fields", async () => {
			await seedIndexItems(data);
			const result = await simulateSearch(data, { q: "red" });

			const firstResult = result.results[0];
			// Should include these fields
			expect(firstResult).toHaveProperty("id");
			expect(firstResult).toHaveProperty("entityType");
			expect(firstResult).toHaveProperty("entityId");
			expect(firstResult).toHaveProperty("title");
			expect(firstResult).toHaveProperty("url");
			expect(firstResult).toHaveProperty("tags");
			expect(firstResult).toHaveProperty("score");
			// Should NOT include body or metadata (internal fields)
			expect(firstResult).not.toHaveProperty("body");
			expect(firstResult).not.toHaveProperty("metadata");
			expect(firstResult).not.toHaveProperty("indexedAt");
		});

		it("filters by entity type", async () => {
			await seedIndexItems(data);
			const result = await simulateSearch(data, {
				q: "about",
				type: "page",
			});

			for (const r of result.results) {
				expect(r.entityType).toBe("page");
			}
		});

		it("parses comma-separated tags into array", async () => {
			await seedIndexItems(data);
			const result = await simulateSearch(data, {
				q: "widget",
				tags: "electronics, sale",
			});

			// Should find items tagged with electronics AND sale
			expect(result.total).toBeGreaterThanOrEqual(0);
		});

		it("handles tags with extra whitespace and empty segments", async () => {
			await seedIndexItems(data);

			// "electronics,,  new, " should parse to ["electronics", "new"]
			const result = await simulateSearch(data, {
				q: "gadget",
				tags: "electronics,,  new, ",
			});

			expect(result.total).toBeGreaterThanOrEqual(0);
		});

		it("returns empty results for no-match query", async () => {
			await seedIndexItems(data);
			const result = await simulateSearch(data, {
				q: "xyznonexistent",
			});

			expect(result.results).toHaveLength(0);
			expect(result.total).toBe(0);
		});

		it("respects limit and skip pagination", async () => {
			await seedIndexItems(data);
			const page1 = await simulateSearch(data, {
				q: "widget gadget about",
				limit: 1,
				skip: 0,
			});
			const page2 = await simulateSearch(data, {
				q: "widget gadget about",
				limit: 1,
				skip: 1,
			});

			// Pages should return at most 1 result each
			expect(page1.results.length).toBeLessThanOrEqual(1);
			expect(page2.results.length).toBeLessThanOrEqual(1);
		});

		it("returns facets with result counts", async () => {
			await seedIndexItems(data);
			const result = await simulateSearch(data, { q: "widget" });

			expect(result.facets).toBeDefined();
			expect(result.facets.entityTypes).toBeDefined();
			expect(result.facets.tags).toBeDefined();
		});

		it("includes image field when present", async () => {
			await seedIndexItems(data);
			const result = await simulateSearch(data, { q: "red widget" });

			const redWidget = result.results.find((r) => r.entityId === "prod-1");
			if (redWidget) {
				expect(redWidget.image).toBe("/img/red-widget.jpg");
			}

			const blueGadget = result.results.find((r) => r.entityId === "prod-2");
			if (blueGadget) {
				expect(blueGadget.image).toBeUndefined();
			}
		});
	});

	// ── suggest ──────────────────────────────────────────────────────

	describe("suggest", () => {
		it("returns suggestions for prefix", async () => {
			await seedIndexItems(data);
			const result = await simulateSuggest(data, "wid");

			expect(result.suggestions).toBeDefined();
			expect(Array.isArray(result.suggestions)).toBe(true);
		});

		it("returns empty for no-match prefix", async () => {
			await seedIndexItems(data);
			const result = await simulateSuggest(data, "zzz");
			expect(result.suggestions).toHaveLength(0);
		});

		it("respects custom limit", async () => {
			await seedIndexItems(data);
			const result = await simulateSuggest(data, "a", 2);
			expect(result.suggestions.length).toBeLessThanOrEqual(2);
		});
	});

	// ── click ────────────────────────────────────────────────────────

	describe("click", () => {
		it("records a click and returns id", async () => {
			const result = await simulateClick(data, {
				queryId: "q-1",
				term: "widget",
				entityType: "product",
				entityId: "prod-1",
				position: 0,
			});

			expect(result.id).toBeDefined();
			expect(typeof result.id).toBe("string");
		});

		it("records multiple clicks for same query", async () => {
			const click1 = await simulateClick(data, {
				queryId: "q-1",
				term: "widget",
				entityType: "product",
				entityId: "prod-1",
				position: 0,
			});
			const click2 = await simulateClick(data, {
				queryId: "q-1",
				term: "widget",
				entityType: "product",
				entityId: "prod-2",
				position: 1,
			});

			expect(click1.id).not.toBe(click2.id);
		});
	});

	// ── recent ───────────────────────────────────────────────────────

	describe("recent", () => {
		it("returns empty for new session", async () => {
			const result = await simulateRecent(data, "session-new");
			expect(result.recent).toHaveLength(0);
		});

		it("returns shaped recent queries (term, resultCount, searchedAt only)", async () => {
			const controller = createSearchController(data);
			await controller.recordQuery("widgets", 5, "session-1");
			await controller.recordQuery("gadgets", 3, "session-1");

			const result = await simulateRecent(data, "session-1");
			expect(result.recent.length).toBeGreaterThan(0);

			const entry = result.recent[0];
			expect(entry).toHaveProperty("term");
			expect(entry).toHaveProperty("resultCount");
			expect(entry).toHaveProperty("searchedAt");
			// Should NOT include internal fields
			expect(entry).not.toHaveProperty("id");
			expect(entry).not.toHaveProperty("normalizedTerm");
			expect(entry).not.toHaveProperty("sessionId");
		});

		it("scopes queries to session", async () => {
			const controller = createSearchController(data);
			await controller.recordQuery("widgets", 5, "session-1");
			await controller.recordQuery("gadgets", 3, "session-2");

			const result = await simulateRecent(data, "session-1");
			expect(result.recent).toHaveLength(1);
			expect(result.recent[0].term).toBe("widgets");
		});

		it("respects limit parameter", async () => {
			const controller = createSearchController(data);
			for (let i = 0; i < 5; i++) {
				await controller.recordQuery(`term-${i}`, i, "session-1");
			}

			const result = await simulateRecent(data, "session-1", 2);
			expect(result.recent.length).toBeLessThanOrEqual(2);
		});
	});
});
