import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSettings } from "../admin/endpoints/get-settings";

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<Record<string, unknown>> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (
		ctx: Record<string, unknown>,
	) => Promise<Record<string, unknown>>;
}

const handler = extractHandler(getSettings);

function createMockController(indexCount = 42) {
	return { getIndexCount: vi.fn().mockResolvedValue(indexCount) };
}

function callGetSettings(
	opts: Record<string, unknown>,
	controllerOverrides?: { indexCount?: number },
) {
	return handler({
		context: {
			options: opts,
			controllers: {
				search: createMockController(controllerOverrides?.indexCount ?? 42),
			},
		},
	});
}

// ── Fetch mocks ──────────────────────────────────────────────────────────────

/** MeiliSearch health OK then stats OK */
function mockMeiliConnected(docCount = 156) {
	const spy = vi.spyOn(globalThis, "fetch");
	spy.mockResolvedValueOnce(
		new Response(JSON.stringify({ status: "available" }), { status: 200 }),
	);
	spy.mockResolvedValueOnce(
		new Response(
			JSON.stringify({
				numberOfDocuments: docCount,
				isIndexing: false,
				fieldDistribution: { id: docCount, title: docCount },
			}),
			{ status: 200 },
		),
	);
}

/** MeiliSearch health endpoint fails */
function mockMeiliUnreachable() {
	vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
		new Error("ECONNREFUSED"),
	);
}

/** MeiliSearch health then stats then embedding models endpoint */
function mockMeiliConnectedAndEmbeddingOk(docCount = 156) {
	const spy = vi.spyOn(globalThis, "fetch");
	// MeiliSearch health
	spy.mockResolvedValueOnce(
		new Response(JSON.stringify({ status: "available" }), { status: 200 }),
	);
	// MeiliSearch stats
	spy.mockResolvedValueOnce(
		new Response(
			JSON.stringify({
				numberOfDocuments: docCount,
				isIndexing: false,
				fieldDistribution: {},
			}),
			{ status: 200 },
		),
	);
	// Embedding /models
	spy.mockResolvedValueOnce(
		new Response(JSON.stringify({ data: [{ id: "text-embedding-3-small" }] }), {
			status: 200,
		}),
	);
}

function mockEmbeddingOk() {
	vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
		new Response(JSON.stringify({ data: [{ id: "text-embedding-3-small" }] }), {
			status: 200,
		}),
	);
}

function mockEmbeddingError(status: number) {
	vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
		new Response(JSON.stringify({ error: { message: "Invalid API key" } }), {
			status,
		}),
	);
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ── MeiliSearch connection status ────────────────────────────────────────────

describe("getSettings — MeiliSearch connection", () => {
	it('returns "connected" with document count when MeiliSearch is healthy', async () => {
		mockMeiliConnected(250);

		const result = await callGetSettings({
			meilisearchHost: "http://meili.test:7700",
			meilisearchApiKey: "master-key-abc123",
		});

		const meili = result.meilisearch as Record<string, unknown>;
		expect(meili.status).toBe("connected");
		expect(meili.documentCount).toBe(250);
		expect(meili.configured).toBe(true);
		expect(meili.error).toBeUndefined();
	});

	it('returns "not_configured" when no MeiliSearch credentials', async () => {
		const result = await callGetSettings({});

		const meili = result.meilisearch as Record<string, unknown>;
		expect(meili.status).toBe("not_configured");
		expect(meili.configured).toBe(false);
		expect(meili.documentCount).toBeUndefined();
	});

	it('returns "not_configured" when only host is set', async () => {
		const result = await callGetSettings({
			meilisearchHost: "http://meili.test:7700",
		});

		const meili = result.meilisearch as Record<string, unknown>;
		expect(meili.status).toBe("not_configured");
		expect(meili.configured).toBe(false);
	});

	it('returns "error" when MeiliSearch is unreachable', async () => {
		mockMeiliUnreachable();

		const result = await callGetSettings({
			meilisearchHost: "http://meili.test:7700",
			meilisearchApiKey: "master-key-abc123",
		});

		const meili = result.meilisearch as Record<string, unknown>;
		expect(meili.status).toBe("error");
		expect(meili.error).toBe("MeiliSearch instance is not reachable");
		expect(meili.configured).toBe(true);
	});

	it("masks the API key in the response", async () => {
		mockMeiliConnected();

		const result = await callGetSettings({
			meilisearchHost: "http://meili.test:7700",
			meilisearchApiKey: "master-key-abc123",
		});

		const meili = result.meilisearch as Record<string, unknown>;
		expect(typeof meili.apiKey).toBe("string");
		expect(meili.apiKey).not.toContain("master-key-abc123");
		expect((meili.apiKey as string).startsWith("mast")).toBe(true);
		expect(meili.apiKey as string).toContain("•");
	});

	it("returns configured host and index UID", async () => {
		mockMeiliConnected();

		const result = await callGetSettings({
			meilisearchHost: "http://meili.test:7700",
			meilisearchApiKey: "master-key-abc123",
			meilisearchIndexUid: "products",
		});

		const meili = result.meilisearch as Record<string, unknown>;
		expect(meili.host).toBe("http://meili.test:7700");
		expect(meili.indexUid).toBe("products");
	});

	it("defaults index UID to 'search'", async () => {
		mockMeiliConnected();

		const result = await callGetSettings({
			meilisearchHost: "http://meili.test:7700",
			meilisearchApiKey: "key123",
		});

		const meili = result.meilisearch as Record<string, unknown>;
		expect(meili.indexUid).toBe("search");
	});
});

// ── Embedding provider connection status ─────────────────────────────────────

describe("getSettings — embedding connection", () => {
	it('returns "connected" when OpenAI API key is valid', async () => {
		mockEmbeddingOk();

		const result = await callGetSettings({
			openaiApiKey: "sk-test-abc123",
		});

		const embeddings = result.embeddings as Record<string, unknown>;
		expect(embeddings.status).toBe("connected");
		expect(embeddings.provider).toBe("openai");
		expect(embeddings.configured).toBe(true);
		expect(embeddings.error).toBeUndefined();
	});

	it('returns "connected" when OpenRouter API key is valid', async () => {
		mockEmbeddingOk();

		const result = await callGetSettings({
			openrouterApiKey: "sk-or-test-abc123",
		});

		const embeddings = result.embeddings as Record<string, unknown>;
		expect(embeddings.status).toBe("connected");
		expect(embeddings.provider).toBe("openrouter");
		expect(embeddings.configured).toBe(true);
	});

	it('returns "not_configured" when no embedding keys', async () => {
		const result = await callGetSettings({});

		const embeddings = result.embeddings as Record<string, unknown>;
		expect(embeddings.status).toBe("not_configured");
		expect(embeddings.provider).toBeNull();
		expect(embeddings.configured).toBe(false);
	});

	it('returns "error" when embedding API rejects the key', async () => {
		mockEmbeddingError(401);

		const result = await callGetSettings({
			openaiApiKey: "sk-invalid-key",
		});

		const embeddings = result.embeddings as Record<string, unknown>;
		expect(embeddings.status).toBe("error");
		expect(embeddings.error).toContain("401");
	});

	it('returns "error" when embedding API is unreachable', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Network failure"),
		);

		const result = await callGetSettings({
			openaiApiKey: "sk-test-abc123",
		});

		const embeddings = result.embeddings as Record<string, unknown>;
		expect(embeddings.status).toBe("error");
		expect(embeddings.error).toContain("Network failure");
	});

	it("returns configured embedding model", async () => {
		mockEmbeddingOk();

		const result = await callGetSettings({
			openaiApiKey: "sk-test-abc123",
			embeddingModel: "text-embedding-ada-002",
		});

		const embeddings = result.embeddings as Record<string, unknown>;
		expect(embeddings.model).toBe("text-embedding-ada-002");
	});

	it("defaults model to text-embedding-3-small", async () => {
		const result = await callGetSettings({});

		const embeddings = result.embeddings as Record<string, unknown>;
		expect(embeddings.model).toBe("text-embedding-3-small");
	});

	it("prefers OpenAI when both keys are set", async () => {
		mockEmbeddingOk();

		const result = await callGetSettings({
			openaiApiKey: "sk-openai",
			openrouterApiKey: "sk-or-key",
		});

		const embeddings = result.embeddings as Record<string, unknown>;
		expect(embeddings.provider).toBe("openai");
	});
});

// ── Combined states ──────────────────────────────────────────────────────────

describe("getSettings — combined providers", () => {
	it("returns both connected when both providers are healthy", async () => {
		mockMeiliConnectedAndEmbeddingOk(100);

		const result = await callGetSettings({
			meilisearchHost: "http://meili.test:7700",
			meilisearchApiKey: "master-key-abc123",
			openaiApiKey: "sk-test-abc123",
		});

		const meili = result.meilisearch as Record<string, unknown>;
		const embeddings = result.embeddings as Record<string, unknown>;
		expect(meili.status).toBe("connected");
		expect(embeddings.status).toBe("connected");
	});

	it("always returns indexCount from the controller", async () => {
		const result = await callGetSettings({}, { indexCount: 99 });
		expect(result.indexCount).toBe(99);
	});

	it("returns indexCount even when providers are not configured", async () => {
		const result = await callGetSettings({}, { indexCount: 0 });
		expect(result.indexCount).toBe(0);
	});
});

// ── Embedding API URL routing ────────────────────────────────────────────────

describe("getSettings — embedding API URL routing", () => {
	it("calls OpenAI models endpoint for openaiApiKey", async () => {
		const spy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [] }), { status: 200 }),
			);

		await callGetSettings({ openaiApiKey: "sk-test" });

		expect(spy).toHaveBeenCalledOnce();
		const [url, opts] = spy.mock.calls[0];
		expect(url).toBe("https://api.openai.com/v1/models");
		expect((opts as RequestInit).headers).toEqual({
			Authorization: "Bearer sk-test",
		});
	});

	it("calls OpenRouter models endpoint for openrouterApiKey", async () => {
		const spy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [] }), { status: 200 }),
			);

		await callGetSettings({ openrouterApiKey: "sk-or-test" });

		expect(spy).toHaveBeenCalledOnce();
		const [url] = spy.mock.calls[0];
		expect(url).toBe("https://openrouter.ai/api/v1/models");
	});
});
