import { describe, expect, it, vi } from "vitest";
import { analyticsEndpoint } from "../admin/endpoints/analytics";
import { bulkIndex } from "../admin/endpoints/bulk-index";
import { clickAnalyticsEndpoint } from "../admin/endpoints/click-analytics";
import { getSettings } from "../admin/endpoints/get-settings";
import { indexItem, removeFromIndex } from "../admin/endpoints/index-manage";
import { popularEndpoint } from "../admin/endpoints/popular";
import {
	addSynonym,
	listSynonyms,
	removeSynonym,
} from "../admin/endpoints/synonyms";
import { zeroResultsEndpoint } from "../admin/endpoints/zero-results";
import type {
	PopularTerm,
	SearchAnalyticsSummary,
	SearchController,
	SearchIndexItem,
	SearchSynonym,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeIndexItem(
	overrides: Partial<SearchIndexItem> = {},
): SearchIndexItem {
	return {
		id: crypto.randomUUID(),
		entityType: "product",
		entityId: "prod_1",
		title: "Blue Widget",
		tags: [],
		url: "/products/blue-widget",
		metadata: {},
		indexedAt: new Date(),
		...overrides,
	};
}

function makeSynonym(overrides: Partial<SearchSynonym> = {}): SearchSynonym {
	return {
		id: crypto.randomUUID(),
		term: "sneaker",
		synonyms: ["shoe", "trainer"],
		createdAt: new Date(),
		...overrides,
	};
}

function makeAnalytics(
	overrides: Partial<SearchAnalyticsSummary> = {},
): SearchAnalyticsSummary {
	return {
		totalQueries: 0,
		uniqueTerms: 0,
		avgResultCount: 0,
		zeroResultCount: 0,
		zeroResultRate: 0,
		clickThroughRate: 0,
		avgClickPosition: 0,
		...overrides,
	};
}

function makeController(
	overrides: Partial<SearchController> = {},
): SearchController {
	return {
		indexItem: vi.fn().mockResolvedValue(makeIndexItem()),
		bulkIndex: vi.fn().mockResolvedValue({ indexed: 0, errors: 0 }),
		removeFromIndex: vi.fn().mockResolvedValue(false),
		search: vi.fn().mockResolvedValue({
			results: [],
			total: 0,
			facets: { entityTypes: [], tags: [] },
		}),
		suggest: vi.fn().mockResolvedValue([]),
		recordQuery: vi.fn().mockResolvedValue({
			id: crypto.randomUUID(),
			term: "",
			normalizedTerm: "",
			resultCount: 0,
			searchedAt: new Date(),
		}),
		recordClick: vi.fn().mockResolvedValue({
			id: crypto.randomUUID(),
			queryId: "",
			term: "",
			entityType: "",
			entityId: "",
			position: 0,
			clickedAt: new Date(),
		}),
		getRecentQueries: vi.fn().mockResolvedValue([]),
		getPopularTerms: vi.fn().mockResolvedValue([]),
		getZeroResultQueries: vi.fn().mockResolvedValue([]),
		getAnalytics: vi.fn().mockResolvedValue(makeAnalytics()),
		addSynonym: vi.fn().mockResolvedValue(makeSynonym()),
		removeSynonym: vi.fn().mockResolvedValue(false),
		listSynonyms: vi.fn().mockResolvedValue([]),
		getIndexCount: vi.fn().mockResolvedValue(0),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: SearchController;
		options?: Record<string, unknown>;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { search: opts.controller ?? makeController() },
			options: opts.options ?? {},
		},
	});
}

const analyticsHandler = extractHandler(analyticsEndpoint);
const bulkIndexHandler = extractHandler(bulkIndex);
const clickAnalyticsHandler = extractHandler(clickAnalyticsEndpoint);
const popularHandler = extractHandler(popularEndpoint);
const zeroResultsHandler = extractHandler(zeroResultsEndpoint);
const listSynonymsHandler = extractHandler(listSynonyms);
const addSynonymHandler = extractHandler(addSynonym);
const removeSynonymHandler = extractHandler(removeSynonym);
const indexItemHandler = extractHandler(indexItem);
const removeFromIndexHandler = extractHandler(removeFromIndex);
const settingsHandler = extractHandler(getSettings);

describe("admin GET /search/analytics", () => {
	it("returns zero-state analytics with indexed items", async () => {
		const result = (await call(analyticsHandler)) as {
			analytics: SearchAnalyticsSummary & { indexedItems: number };
		};
		expect(result.analytics.totalQueries).toBe(0);
		expect(result.analytics.indexedItems).toBe(0);
	});

	it("combines getAnalytics and getIndexCount into response", async () => {
		const ctrl = makeController({
			getAnalytics: vi.fn().mockResolvedValue(
				makeAnalytics({
					totalQueries: 500,
					uniqueTerms: 120,
					clickThroughRate: 0.35,
					avgClickPosition: 2.1,
				}),
			),
			getIndexCount: vi.fn().mockResolvedValue(1042),
		});
		const result = (await call(analyticsHandler, {
			controller: ctrl,
		})) as { analytics: SearchAnalyticsSummary & { indexedItems: number } };
		expect(result.analytics.totalQueries).toBe(500);
		expect(result.analytics.uniqueTerms).toBe(120);
		expect(result.analytics.indexedItems).toBe(1042);
		expect(ctrl.getAnalytics).toHaveBeenCalled();
		expect(ctrl.getIndexCount).toHaveBeenCalled();
	});
});

describe("admin POST /search/index/bulk", () => {
	it("returns indexed and error counts", async () => {
		const ctrl = makeController({
			bulkIndex: vi.fn().mockResolvedValue({ indexed: 3, errors: 1 }),
		});
		const result = (await call(bulkIndexHandler, {
			body: {
				items: [
					{ entityType: "product", entityId: "p1", title: "A", url: "/a" },
					{ entityType: "product", entityId: "p2", title: "B", url: "/b" },
					{ entityType: "product", entityId: "p3", title: "C", url: "/c" },
					{ entityType: "product", entityId: "p4", title: "D", url: "/d" },
				],
			},
			controller: ctrl,
		})) as { indexed: number; errors: number };
		expect(result.indexed).toBe(3);
		expect(result.errors).toBe(1);
	});

	it("calls controller.bulkIndex with items array", async () => {
		const ctrl = makeController({
			bulkIndex: vi.fn().mockResolvedValue({ indexed: 1, errors: 0 }),
		});
		await call(bulkIndexHandler, {
			body: {
				items: [
					{
						entityType: "product",
						entityId: "prod_5",
						title: "Widget",
						url: "/products/widget",
					},
				],
			},
			controller: ctrl,
		});
		expect(ctrl.bulkIndex).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ entityId: "prod_5", title: "Widget" }),
			]),
		);
	});
});

describe("admin GET /search/clicks", () => {
	it("returns zero click-through rate and avg position", async () => {
		const result = (await call(clickAnalyticsHandler)) as {
			clickThroughRate: number;
			avgClickPosition: number;
		};
		expect(result.clickThroughRate).toBe(0);
		expect(result.avgClickPosition).toBe(0);
	});

	it("extracts clickThroughRate and avgClickPosition from analytics", async () => {
		const ctrl = makeController({
			getAnalytics: vi
				.fn()
				.mockResolvedValue(
					makeAnalytics({ clickThroughRate: 0.42, avgClickPosition: 3.7 }),
				),
		});
		const result = (await call(clickAnalyticsHandler, {
			controller: ctrl,
		})) as { clickThroughRate: number; avgClickPosition: number };
		expect(result.clickThroughRate).toBe(0.42);
		expect(result.avgClickPosition).toBe(3.7);
		expect(ctrl.getAnalytics).toHaveBeenCalled();
	});
});

describe("admin GET /search/popular", () => {
	it("returns empty terms list", async () => {
		const result = (await call(popularHandler)) as { terms: PopularTerm[] };
		expect(result.terms).toHaveLength(0);
	});

	it("returns popular terms from controller", async () => {
		const terms: PopularTerm[] = [
			{ term: "shirt", count: 200, avgResultCount: 15 },
			{ term: "hat", count: 150, avgResultCount: 8 },
		];
		const ctrl = makeController({
			getPopularTerms: vi.fn().mockResolvedValue(terms),
		});
		const result = (await call(popularHandler, {
			controller: ctrl,
		})) as { terms: PopularTerm[] };
		expect(result.terms).toHaveLength(2);
		expect(result.terms[0].term).toBe("shirt");
	});
});

describe("admin GET /search/zero-results", () => {
	it("returns empty terms list", async () => {
		const result = (await call(zeroResultsHandler)) as { terms: PopularTerm[] };
		expect(result.terms).toHaveLength(0);
	});

	it("returns zero-result terms from controller", async () => {
		const terms: PopularTerm[] = [
			{ term: "unobtanium", count: 42, avgResultCount: 0 },
		];
		const ctrl = makeController({
			getZeroResultQueries: vi.fn().mockResolvedValue(terms),
		});
		const result = (await call(zeroResultsHandler, {
			controller: ctrl,
		})) as { terms: PopularTerm[] };
		expect(result.terms[0].term).toBe("unobtanium");
		expect(ctrl.getZeroResultQueries).toHaveBeenCalled();
	});
});

describe("admin GET /search/synonyms", () => {
	it("returns empty synonyms list", async () => {
		const result = (await call(listSynonymsHandler)) as {
			synonyms: SearchSynonym[];
		};
		expect(result.synonyms).toHaveLength(0);
	});

	it("returns synonyms from controller", async () => {
		const synonyms = [
			makeSynonym({ term: "couch", synonyms: ["sofa", "settee"] }),
		];
		const ctrl = makeController({
			listSynonyms: vi.fn().mockResolvedValue(synonyms),
		});
		const result = (await call(listSynonymsHandler, {
			controller: ctrl,
		})) as { synonyms: SearchSynonym[] };
		expect(result.synonyms).toHaveLength(1);
		expect(result.synonyms[0].term).toBe("couch");
	});
});

describe("admin POST /search/synonyms/add", () => {
	it("adds a synonym and returns it", async () => {
		const synonym = makeSynonym({
			term: "sneaker",
			synonyms: ["shoe", "trainer"],
		});
		const ctrl = makeController({
			addSynonym: vi.fn().mockResolvedValue(synonym),
		});
		const result = (await call(addSynonymHandler, {
			body: { term: "sneaker", synonyms: ["shoe", "trainer"] },
			controller: ctrl,
		})) as { synonym: SearchSynonym };
		expect(result.synonym.term).toBe("sneaker");
		expect(result.synonym.synonyms).toContain("shoe");
		expect(ctrl.addSynonym).toHaveBeenCalledWith("sneaker", [
			"shoe",
			"trainer",
		]);
	});
});

describe("admin POST /search/synonyms/:id/delete", () => {
	it("returns 404 when synonym not found", async () => {
		const result = (await call(removeSynonymHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Synonym not found");
		expect(result.status).toBe(404);
	});

	it("removes synonym and returns success", async () => {
		const ctrl = makeController({
			removeSynonym: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(removeSynonymHandler, {
			params: { id: "syn_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.removeSynonym).toHaveBeenCalledWith("syn_1");
	});
});

describe("admin POST /search/index", () => {
	it("indexes an item and returns it", async () => {
		const item = makeIndexItem({ entityId: "prod_10", title: "Red Hat" });
		const ctrl = makeController({
			indexItem: vi.fn().mockResolvedValue(item),
		});
		const result = (await call(indexItemHandler, {
			body: {
				entityType: "product",
				entityId: "prod_10",
				title: "Red Hat",
				url: "/products/red-hat",
			},
			controller: ctrl,
		})) as { item: SearchIndexItem };
		expect(result.item.entityId).toBe("prod_10");
		expect(result.item.title).toBe("Red Hat");
		expect(ctrl.indexItem).toHaveBeenCalledWith(
			expect.objectContaining({ entityId: "prod_10", title: "Red Hat" }),
		);
	});
});

describe("admin POST /search/index/remove", () => {
	it("returns removed=false when item not found", async () => {
		const result = (await call(removeFromIndexHandler, {
			body: { entityType: "product", entityId: "gone" },
		})) as { removed: boolean };
		expect(result.removed).toBe(false);
	});

	it("returns removed=true when item deleted", async () => {
		const ctrl = makeController({
			removeFromIndex: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(removeFromIndexHandler, {
			body: { entityType: "product", entityId: "prod_2" },
			controller: ctrl,
		})) as { removed: boolean };
		expect(result.removed).toBe(true);
		expect(ctrl.removeFromIndex).toHaveBeenCalledWith("product", "prod_2");
	});
});

describe("admin GET /search/settings", () => {
	it("returns not_configured for meilisearch and embeddings when options are empty", async () => {
		const ctrl = makeController({
			getIndexCount: vi.fn().mockResolvedValue(0),
		});
		const result = (await call(settingsHandler, {
			controller: ctrl,
		})) as {
			meilisearch: { status: string; configured: boolean };
			embeddings: { status: string; configured: boolean };
			indexCount: number;
		};
		expect(result.meilisearch.status).toBe("not_configured");
		expect(result.meilisearch.configured).toBe(false);
		expect(result.embeddings.status).toBe("not_configured");
		expect(result.embeddings.configured).toBe(false);
	});

	it("includes indexCount from controller", async () => {
		const ctrl = makeController({
			getIndexCount: vi.fn().mockResolvedValue(250),
		});
		const result = (await call(settingsHandler, {
			controller: ctrl,
		})) as { indexCount: number };
		expect(result.indexCount).toBe(250);
		expect(ctrl.getIndexCount).toHaveBeenCalled();
	});

	it("shows masked api key as null when not configured", async () => {
		const ctrl = makeController({
			getIndexCount: vi.fn().mockResolvedValue(0),
		});
		const result = (await call(settingsHandler, {
			controller: ctrl,
		})) as {
			meilisearch: { apiKey: string | null; host: string | null };
		};
		expect(result.meilisearch.apiKey).toBeNull();
		expect(result.meilisearch.host).toBeNull();
	});
});
