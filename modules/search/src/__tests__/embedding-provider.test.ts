import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	cosineSimilarity,
	OpenAIEmbeddingProvider,
} from "../embedding-provider";

// ── cosineSimilarity ───────────────────────────────────────────────────

describe("cosineSimilarity", () => {
	it("returns 1 for identical vectors", () => {
		expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
	});

	it("returns -1 for opposite vectors", () => {
		expect(cosineSimilarity([1, 0, 0], [-1, 0, 0])).toBeCloseTo(-1);
	});

	it("returns 0 for orthogonal vectors", () => {
		expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
	});

	it("returns 0 for empty vectors", () => {
		expect(cosineSimilarity([], [])).toBe(0);
	});

	it("returns 0 for mismatched lengths", () => {
		expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
	});

	it("returns 0 for zero vectors", () => {
		expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
	});

	it("computes correct similarity for non-trivial vectors", () => {
		// cos([1,2,3], [4,5,6]) = 32 / (sqrt(14) * sqrt(77)) ≈ 0.9746
		expect(cosineSimilarity([1, 2, 3], [4, 5, 6])).toBeCloseTo(0.9746, 3);
	});
});

// ── OpenAIEmbeddingProvider ────────────────────────────────────────────

describe("OpenAIEmbeddingProvider", () => {
	const originalFetch = globalThis.fetch;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFetch = vi.fn();
		globalThis.fetch = mockFetch as typeof fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	function makeProvider(opts?: { model?: string; baseUrl?: string }) {
		return new OpenAIEmbeddingProvider("test-api-key", opts);
	}

	function mockEmbeddingResponse(embeddings: number[][]) {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				data: embeddings.map((embedding, index) => ({ embedding, index })),
				model: "text-embedding-3-small",
				usage: { prompt_tokens: 10, total_tokens: 10 },
			}),
		});
	}

	// ── generateEmbedding ──────────────────────────────────────────────

	describe("generateEmbedding", () => {
		it("returns an embedding vector", async () => {
			const vec = [0.1, 0.2, 0.3];
			mockEmbeddingResponse([vec]);

			const provider = makeProvider();
			const result = await provider.generateEmbedding("hello world");

			expect(result).toEqual(vec);
			expect(mockFetch).toHaveBeenCalledOnce();
		});

		it("sends correct request to OpenAI", async () => {
			mockEmbeddingResponse([[0.1]]);

			const provider = makeProvider();
			await provider.generateEmbedding("test input");

			const [url, options] = mockFetch.mock.calls[0];
			expect(url).toBe("https://api.openai.com/v1/embeddings");
			expect(options.method).toBe("POST");
			expect(options.headers.Authorization).toBe("Bearer test-api-key");
			const body = JSON.parse(options.body);
			expect(body.input).toEqual(["test input"]);
			expect(body.model).toBe("text-embedding-3-small");
		});

		it("uses custom base URL and model", async () => {
			mockEmbeddingResponse([[0.1]]);

			const provider = makeProvider({
				model: "custom-model",
				baseUrl: "https://custom.api/v1",
			});
			await provider.generateEmbedding("test");

			const [url, options] = mockFetch.mock.calls[0];
			expect(url).toBe("https://custom.api/v1/embeddings");
			const body = JSON.parse(options.body);
			expect(body.model).toBe("custom-model");
		});

		it("returns null on API error", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 429,
				json: async () => ({
					error: { message: "Rate limit exceeded", type: "rate_limit" },
				}),
			});

			const provider = makeProvider();
			const result = await provider.generateEmbedding("test");
			expect(result).toBeNull();
		});

		it("returns null on network error", async () => {
			mockFetch.mockRejectedValueOnce(new Error("Network error"));

			const provider = makeProvider();
			const result = await provider.generateEmbedding("test");
			expect(result).toBeNull();
		});
	});

	// ── generateEmbeddings ─────────────────────────────────────────────

	describe("generateEmbeddings", () => {
		it("returns multiple embeddings", async () => {
			const vecs = [
				[0.1, 0.2],
				[0.3, 0.4],
			];
			mockEmbeddingResponse(vecs);

			const provider = makeProvider();
			const results = await provider.generateEmbeddings(["foo", "bar"]);

			expect(results).toEqual(vecs);
		});

		it("returns empty array for empty input", async () => {
			const provider = makeProvider();
			const results = await provider.generateEmbeddings([]);

			expect(results).toEqual([]);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("returns nulls for all-whitespace inputs", async () => {
			const provider = makeProvider();
			const results = await provider.generateEmbeddings(["  ", "\t", "\n"]);

			expect(results).toEqual([null, null, null]);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("truncates inputs longer than 8000 chars", async () => {
			mockEmbeddingResponse([[0.1]]);

			const provider = makeProvider();
			const longText = "a".repeat(10000);
			await provider.generateEmbeddings([longText]);

			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.input[0].length).toBe(8000);
		});

		it("returns nulls on API error", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: async () => ({
					error: { message: "Internal error", type: "server_error" },
				}),
			});

			const provider = makeProvider();
			const results = await provider.generateEmbeddings(["a", "b"]);

			expect(results).toEqual([null, null]);
		});
	});
});
