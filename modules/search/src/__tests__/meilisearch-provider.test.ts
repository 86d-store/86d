import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MeiliSearchProvider } from "../meilisearch-provider";

const MOCK_HOST = "http://meili.test:7700";
const MOCK_KEY = "test-master-key-abc123";

// ── Realistic MeiliSearch API response fixtures ──────────────────────────

const taskResponse = {
	taskUid: 42,
	indexUid: "search",
	status: "enqueued" as const,
	type: "documentAdditionOrUpdate",
	enqueuedAt: "2026-03-17T10:00:00.000Z",
};

const searchResponse = {
	hits: [
		{
			id: "idx-001",
			entityType: "product",
			entityId: "prod-abc",
			title: "Organic Cotton T-Shirt",
			body: "Soft, breathable organic cotton tee. Available in multiple colors.",
			tags: ["clothing", "organic", "cotton"],
			url: "/products/organic-cotton-t-shirt",
			image: "https://blob.store/images/tshirt.jpg",
			indexedAt: "2026-03-15T08:30:00.000Z",
			_formatted: {
				title: "Organic Cotton <mark>T-Shirt</mark>",
				body: "Soft, breathable organic cotton tee. Available in multiple colors.",
			},
			_rankingScore: 0.92,
		},
		{
			id: "idx-002",
			entityType: "product",
			entityId: "prod-def",
			title: "Vintage Band T-Shirt",
			body: "Classic vintage-style band t-shirt with distressed print.",
			tags: ["clothing", "vintage"],
			url: "/products/vintage-band-t-shirt",
			image: null,
			indexedAt: "2026-03-14T12:00:00.000Z",
			_formatted: {
				title: "Vintage Band <mark>T-Shirt</mark>",
				body: "Classic vintage-style band <mark>t-shirt</mark> with distressed print.",
			},
			_rankingScore: 0.78,
		},
	],
	query: "t-shirt",
	processingTimeMs: 3,
	estimatedTotalHits: 2,
	facetDistribution: {
		entityType: { product: 2 },
		tags: { clothing: 2, organic: 1, cotton: 1, vintage: 1 },
	},
};

const errorResponse = {
	message: "Index `nonexistent` not found.",
	code: "index_not_found",
	type: "invalid_request",
	link: "https://docs.meilisearch.com/errors#index_not_found",
};

const healthResponse = { status: "available" as const };

const statsResponse = {
	numberOfDocuments: 156,
	isIndexing: false,
	fieldDistribution: {
		id: 156,
		entityType: 156,
		title: 156,
		body: 142,
		tags: 156,
		url: 156,
	},
};

// ── Tests ────────────────────────────────────────────────────────────────

describe("MeiliSearchProvider", () => {
	let provider: MeiliSearchProvider;
	const mockFetch = vi.fn();

	beforeEach(() => {
		mockFetch.mockClear();
		provider = new MeiliSearchProvider(MOCK_HOST, MOCK_KEY, "search");
		vi.stubGlobal("fetch", mockFetch);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// ── addDocuments ──────────────────────────────────────────────────

	describe("addDocuments", () => {
		it("sends documents to the correct endpoint with Bearer auth", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 202,
				json: () => Promise.resolve(taskResponse),
			});

			const docs = [
				{
					id: "idx-001",
					entityType: "product",
					entityId: "prod-abc",
					title: "Organic Cotton T-Shirt",
					tags: ["clothing"],
					url: "/products/organic-cotton-t-shirt",
					indexedAt: "2026-03-15T08:30:00.000Z",
				},
			];

			const result = await provider.addDocuments(docs);

			expect(mockFetch).toHaveBeenCalledOnce();
			const [url, opts] = mockFetch.mock.calls[0];
			expect(url).toBe(`${MOCK_HOST}/indexes/search/documents`);
			expect(opts.method).toBe("POST");
			expect(opts.headers.Authorization).toBe(`Bearer ${MOCK_KEY}`);
			expect(opts.headers["Content-Type"]).toBe("application/json");
			expect(JSON.parse(opts.body)).toEqual(docs);
			expect(result.taskUid).toBe(42);
			expect(result.status).toBe("enqueued");
		});

		it("throws on API error with descriptive message", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: () => Promise.resolve(errorResponse),
			});

			await expect(provider.addDocuments([])).rejects.toThrow(
				"MeiliSearch error: Index `nonexistent` not found. (index_not_found)",
			);
		});
	});

	// ── deleteDocument ────────────────────────────────────────────────

	describe("deleteDocument", () => {
		it("sends DELETE request for the document ID", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 202,
				json: () =>
					Promise.resolve({
						...taskResponse,
						type: "documentDeletion",
					}),
			});

			const result = await provider.deleteDocument("idx-001");

			const [url, opts] = mockFetch.mock.calls[0];
			expect(url).toBe(`${MOCK_HOST}/indexes/search/documents/idx-001`);
			expect(opts.method).toBe("DELETE");
			expect(result.taskUid).toBe(42);
		});

		it("URL-encodes document IDs with special characters", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 202,
				json: () => Promise.resolve(taskResponse),
			});

			await provider.deleteDocument("id/with/slashes");

			const [url] = mockFetch.mock.calls[0];
			expect(url).toBe(
				`${MOCK_HOST}/indexes/search/documents/id%2Fwith%2Fslashes`,
			);
		});
	});

	// ── search ───────────────────────────────────────────────────────

	describe("search", () => {
		it("sends POST request with query and returns hits", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve(searchResponse),
			});

			const result = await provider.search("t-shirt", {
				limit: 20,
				offset: 0,
				facets: ["entityType", "tags"],
				attributesToHighlight: ["title", "body"],
				highlightPreTag: "<mark>",
				highlightPostTag: "</mark>",
				showRankingScore: true,
			});

			const [url, opts] = mockFetch.mock.calls[0];
			expect(url).toBe(`${MOCK_HOST}/indexes/search/search`);
			expect(opts.method).toBe("POST");

			const body = JSON.parse(opts.body);
			expect(body.q).toBe("t-shirt");
			expect(body.limit).toBe(20);
			expect(body.facets).toEqual(["entityType", "tags"]);
			expect(body.attributesToHighlight).toEqual(["title", "body"]);
			expect(body.highlightPreTag).toBe("<mark>");
			expect(body.showRankingScore).toBe(true);

			expect(result.hits).toHaveLength(2);
			expect(result.hits[0].title).toBe("Organic Cotton T-Shirt");
			expect(result.hits[0]._formatted?.title).toBe(
				"Organic Cotton <mark>T-Shirt</mark>",
			);
			expect(result.hits[0]._rankingScore).toBe(0.92);
			expect(result.estimatedTotalHits).toBe(2);
			expect(result.processingTimeMs).toBe(3);
			expect(result.facetDistribution?.entityType).toEqual({ product: 2 });
		});

		it("passes filter and sort options", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ ...searchResponse, hits: [] }),
			});

			await provider.search("shoes", {
				filter: 'entityType = "product" AND (tags = "footwear")',
				sort: ["indexedAt:desc"],
				matchingStrategy: "last",
			});

			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.filter).toBe(
				'entityType = "product" AND (tags = "footwear")',
			);
			expect(body.sort).toEqual(["indexedAt:desc"]);
			expect(body.matchingStrategy).toBe("last");
		});

		it("sends minimal body when no options provided", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ ...searchResponse, hits: [] }),
			});

			await provider.search("test");

			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body).toEqual({ q: "test" });
		});
	});

	// ── isHealthy ────────────────────────────────────────────────────

	describe("isHealthy", () => {
		it("returns true when MeiliSearch is available", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve(healthResponse),
			});

			expect(await provider.isHealthy()).toBe(true);

			const [url, opts] = mockFetch.mock.calls[0];
			expect(url).toBe(`${MOCK_HOST}/health`);
			expect(opts.method).toBe("GET");
		});

		it("returns false when MeiliSearch is unreachable", async () => {
			mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

			expect(await provider.isHealthy()).toBe(false);
		});

		it("returns false on non-200 response", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 503,
				json: () =>
					Promise.resolve({ message: "Server unavailable", code: "503" }),
			});

			expect(await provider.isHealthy()).toBe(false);
		});
	});

	// ── getStats ──────────────────────────────────────────────────────

	describe("getStats", () => {
		it("returns index statistics", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve(statsResponse),
			});

			const stats = await provider.getStats();

			expect(stats).not.toBeNull();
			expect(stats?.numberOfDocuments).toBe(156);
			expect(stats?.isIndexing).toBe(false);
			expect(stats?.fieldDistribution.title).toBe(156);
		});

		it("returns null when stats endpoint fails", async () => {
			mockFetch.mockRejectedValueOnce(new Error("Network error"));

			expect(await provider.getStats()).toBeNull();
		});
	});

	// ── configureIndex ───────────────────────────────────────────────

	describe("configureIndex", () => {
		it("sends PATCH request with filterable and sortable attributes", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 202,
				json: () => Promise.resolve(taskResponse),
			});

			await provider.configureIndex();

			const [url, opts] = mockFetch.mock.calls[0];
			expect(url).toBe(`${MOCK_HOST}/indexes/search/settings`);
			expect(opts.method).toBe("PATCH");

			const body = JSON.parse(opts.body);
			expect(body.filterableAttributes).toContain("entityType");
			expect(body.filterableAttributes).toContain("tags");
			expect(body.sortableAttributes).toContain("indexedAt");
			expect(body.searchableAttributes).toContain("title");
			expect(body.searchableAttributes).toContain("body");
		});

		it("silently handles errors during index configuration", async () => {
			mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

			await expect(provider.configureIndex()).resolves.toBeUndefined();
		});
	});

	// ── constructor ──────────────────────────────────────────────────

	describe("constructor", () => {
		it("strips trailing slash from host", async () => {
			const p = new MeiliSearchProvider("http://meili.test:7700/", MOCK_KEY);
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve(healthResponse),
			});

			await p.isHealthy();

			expect(mockFetch.mock.calls[0][0]).toBe("http://meili.test:7700/health");
		});

		it("uses custom index UID when provided", async () => {
			const p = new MeiliSearchProvider(MOCK_HOST, MOCK_KEY, "products");
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ ...searchResponse, hits: [] }),
			});

			await p.search("test");

			expect(mockFetch.mock.calls[0][0]).toBe(
				`${MOCK_HOST}/indexes/products/search`,
			);
		});

		it("defaults index UID to 'search'", async () => {
			const p = new MeiliSearchProvider(MOCK_HOST, MOCK_KEY);
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ ...searchResponse, hits: [] }),
			});

			await p.search("test");

			expect(mockFetch.mock.calls[0][0]).toBe(
				`${MOCK_HOST}/indexes/search/search`,
			);
		});
	});
});
