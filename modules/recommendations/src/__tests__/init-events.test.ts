/**
 * Tests for the recommendations module's init() event handlers.
 *
 * When an embeddingProvider is configured, the module subscribes to
 * product.created and product.updated events and auto-generates embeddings.
 */
import { createEventBus, createScopedEmitter } from "@86d-app/core/events";
import {
	createMockDataService,
	createMockModuleContext,
} from "@86d-app/core/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import recommendations from "../index";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Return a fake OpenAI-shaped embedding response. */
function mockEmbeddingFetch(
	mockFetch: ReturnType<typeof vi.fn>,
	vec?: number[],
) {
	const embedding = vec ?? [0.1, 0.2, 0.3];
	mockFetch.mockResolvedValue({
		ok: true,
		json: async () => ({
			data: [{ embedding, index: 0 }],
			model: "text-embedding-3-small",
			usage: { prompt_tokens: 5, total_tokens: 5 },
		}),
	});
}

async function initModule(
	mod: ReturnType<typeof recommendations>,
	data: ReturnType<typeof createMockDataService>,
	events?: ReturnType<typeof createScopedEmitter>,
) {
	const init = mod.init;
	expect(init).toBeDefined();
	if (init) {
		const ctx = createMockModuleContext({ data });
		await init({ ...ctx, events });
	}
}

/** Wait briefly for fire-and-forget async handlers to complete. */
function flushAsync(): Promise<void> {
	return new Promise<void>((r) => {
		setTimeout(r, 50);
	});
}

// ── product.created with embeddingProvider ───────────────────────────────────

describe("product.created event — with embeddingProvider", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockData = createMockDataService();
		mockFetch = vi.fn();
		globalThis.fetch = mockFetch as typeof fetch;
		mockEmbeddingFetch(mockFetch);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("registers a product.created listener when embeddingProvider is configured", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "recommendations");

		await initModule(
			recommendations({ openaiApiKey: "sk-test-key" }),
			mockData,
			emitter,
		);

		expect(bus.listenerCount("product.created")).toBe(1);
	});

	it("generates an embedding when a product is created", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "recommendations");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(
			recommendations({ openaiApiKey: "sk-test-key" }),
			mockData,
			emitter,
		);

		await productsEmitter.emit("product.created", {
			productId: "prod-1",
			name: "Running Shoes",
			slug: "running-shoes",
			price: 7999,
		});
		await flushAsync();

		const embeddings = mockData.all("productEmbedding");
		expect(embeddings).toHaveLength(1);
		expect(embeddings[0]).toMatchObject({
			productId: "prod-1",
			embedding: [0.1, 0.2, 0.3],
		});
	});

	it("stores the product name as the embedding text", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "recommendations");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(
			recommendations({ openaiApiKey: "sk-test-key" }),
			mockData,
			emitter,
		);

		await productsEmitter.emit("product.created", {
			productId: "prod-text",
			name: "Wireless Headphones",
			slug: "wireless-headphones",
		});
		await flushAsync();

		const embeddings = mockData.all("productEmbedding");
		expect(embeddings).toHaveLength(1);
		expect(embeddings[0]).toMatchObject({ text: "Wireless Headphones" });
	});

	it("stores product metadata alongside the embedding", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "recommendations");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(
			recommendations({ openaiApiKey: "sk-test-key" }),
			mockData,
			emitter,
		);

		await productsEmitter.emit("product.created", {
			productId: "prod-meta",
			name: "Smart Watch",
			slug: "smart-watch",
			price: 29999,
		});
		await flushAsync();

		const embeddings = mockData.all("productEmbedding");
		expect(embeddings).toHaveLength(1);
		expect(embeddings[0]).toMatchObject({
			productName: "Smart Watch",
			productSlug: "smart-watch",
			productPrice: 29999,
		});
	});

	it("generates embeddings for multiple products", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "recommendations");
		const productsEmitter = createScopedEmitter(bus, "products");

		// Each product gets its own mock response
		for (let i = 1; i <= 3; i++) {
			mockEmbeddingFetch(mockFetch, [i * 0.1, i * 0.2]);
		}

		await initModule(
			recommendations({ openaiApiKey: "sk-test-key" }),
			mockData,
			emitter,
		);

		for (let i = 1; i <= 3; i++) {
			await productsEmitter.emit("product.created", {
				productId: `prod-${i}`,
				name: `Product ${i}`,
				slug: `product-${i}`,
			});
		}
		await flushAsync();

		const embeddings = mockData.all("productEmbedding");
		expect(embeddings).toHaveLength(3);
	});
});

// ── product.updated with embeddingProvider ───────────────────────────────────

describe("product.updated event — with embeddingProvider", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockData = createMockDataService();
		mockFetch = vi.fn();
		globalThis.fetch = mockFetch as typeof fetch;
		mockEmbeddingFetch(mockFetch);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("registers a product.updated listener when embeddingProvider is configured", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "recommendations");

		await initModule(
			recommendations({ openaiApiKey: "sk-test-key" }),
			mockData,
			emitter,
		);

		expect(bus.listenerCount("product.updated")).toBe(1);
	});

	it("regenerates an embedding when a product is updated", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "recommendations");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(
			recommendations({ openaiApiKey: "sk-test-key" }),
			mockData,
			emitter,
		);

		await productsEmitter.emit("product.updated", {
			productId: "prod-updated",
			name: "Updated Product Name",
			slug: "updated-product-name",
			price: 4999,
		});
		await flushAsync();

		const embeddings = mockData.all("productEmbedding");
		expect(embeddings).toHaveLength(1);
		expect(embeddings[0]).toMatchObject({
			productId: "prod-updated",
			text: "Updated Product Name",
		});
	});

	it("updates an existing embedding rather than creating a duplicate", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "recommendations");
		const productsEmitter = createScopedEmitter(bus, "products");

		// Provide two responses: create then update
		mockEmbeddingFetch(mockFetch, [0.1, 0.2, 0.3]);
		mockEmbeddingFetch(mockFetch, [0.4, 0.5, 0.6]);

		await initModule(
			recommendations({ openaiApiKey: "sk-test-key" }),
			mockData,
			emitter,
		);

		// Create
		await productsEmitter.emit("product.created", {
			productId: "prod-upsert",
			name: "Original Name",
			slug: "original-name",
		});
		await flushAsync();

		// Update — should overwrite the same record
		await productsEmitter.emit("product.updated", {
			productId: "prod-upsert",
			name: "New Name",
			slug: "new-name",
		});
		await flushAsync();

		const embeddings = mockData.all("productEmbedding");
		expect(embeddings).toHaveLength(1);
		expect(embeddings[0]).toMatchObject({ text: "New Name" });
	});
});

// ── no embeddingProvider (no event listeners) ────────────────────────────────

describe("init without embeddingProvider", () => {
	it("does NOT register product.created listener when no API key is provided", async () => {
		const mockData = createMockDataService();
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "recommendations");

		await initModule(recommendations(), mockData, emitter);

		expect(bus.listenerCount("product.created")).toBe(0);
	});

	it("does NOT register product.updated listener when no API key is provided", async () => {
		const mockData = createMockDataService();
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "recommendations");

		await initModule(recommendations(), mockData, emitter);

		expect(bus.listenerCount("product.updated")).toBe(0);
	});

	it("still initializes controller successfully without API key", async () => {
		const mockData = createMockDataService();
		const mod = recommendations();
		const ctx = createMockModuleContext({ data: mockData });

		const init = mod.init;
		expect(init).toBeDefined();
		if (!init) {
			throw new Error("expected init");
		}
		const result = await init({ ...ctx, events: undefined });
		expect(result).toBeDefined();
	});
});

// ── graceful failure handling ────────────────────────────────────────────────

describe("graceful failure handling", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockData = createMockDataService();
		mockFetch = vi.fn();
		globalThis.fetch = mockFetch as typeof fetch;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("does not throw when the embedding API returns an error", async () => {
		mockFetch.mockResolvedValue({
			ok: false,
			status: 429,
			json: async () => ({ error: { message: "Rate limit exceeded" } }),
		});

		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "recommendations");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(
			recommendations({ openaiApiKey: "sk-test-key" }),
			mockData,
			emitter,
		);

		await expect(
			productsEmitter.emit("product.created", {
				productId: "prod-fail",
				name: "Failed Product",
				slug: "failed-product",
			}),
		).resolves.not.toThrow();

		await flushAsync();
		// No embeddings stored since the API failed
		expect(mockData.all("productEmbedding")).toHaveLength(0);
	});

	it("does not throw when fetch itself rejects", async () => {
		mockFetch.mockRejectedValue(new Error("Network error"));

		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "recommendations");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(
			recommendations({ openaiApiKey: "sk-test-key" }),
			mockData,
			emitter,
		);

		await expect(
			productsEmitter.emit("product.created", {
				productId: "prod-network-fail",
				name: "Network Fail Product",
				slug: "network-fail-product",
			}),
		).resolves.not.toThrow();

		await flushAsync();
		expect(mockData.all("productEmbedding")).toHaveLength(0);
	});
});
