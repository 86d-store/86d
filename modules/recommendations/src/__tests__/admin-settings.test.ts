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

function createMockController(embeddingsCount = 100) {
	return { getStats: vi.fn().mockResolvedValue({ embeddingsCount }) };
}

function callGetSettings(
	opts: Record<string, unknown>,
	controllerOverrides?: { embeddingsCount?: number },
) {
	return handler({
		context: {
			options: opts,
			controllers: {
				recommendations: createMockController(
					controllerOverrides?.embeddingsCount ?? 100,
				),
			},
		},
	});
}

function mockFetchOk() {
	vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
		new Response(JSON.stringify({ data: [{ id: "text-embedding-3-small" }] }), {
			status: 200,
		}),
	);
}

function mockFetchError(status: number) {
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

// ── AI provider connection status ────────────────────────────────────────────

describe("getSettings — AI connection verification", () => {
	it('returns "connected" when OpenAI API key is valid', async () => {
		mockFetchOk();

		const result = await callGetSettings({ openaiApiKey: "sk-test-abc123" });

		const ai = result.ai as Record<string, unknown>;
		expect(ai.status).toBe("connected");
		expect(ai.provider).toBe("openai");
		expect(ai.configured).toBe(true);
		expect(ai.error).toBeUndefined();
	});

	it('returns "connected" when OpenRouter API key is valid', async () => {
		mockFetchOk();

		const result = await callGetSettings({
			openrouterApiKey: "sk-or-test-abc123",
		});

		const ai = result.ai as Record<string, unknown>;
		expect(ai.status).toBe("connected");
		expect(ai.provider).toBe("openrouter");
	});

	it('returns "not_configured" when no AI keys are set', async () => {
		const result = await callGetSettings({});

		const ai = result.ai as Record<string, unknown>;
		expect(ai.status).toBe("not_configured");
		expect(ai.configured).toBe(false);
		expect(ai.provider).toBeNull();
		expect(ai.error).toBeUndefined();
	});

	it('returns "error" when API rejects the key', async () => {
		mockFetchError(401);

		const result = await callGetSettings({ openaiApiKey: "sk-invalid" });

		const ai = result.ai as Record<string, unknown>;
		expect(ai.status).toBe("error");
		expect(ai.error).toContain("401");
	});

	it('returns "error" when API is unreachable', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Network failure"),
		);

		const result = await callGetSettings({ openaiApiKey: "sk-test-abc" });

		const ai = result.ai as Record<string, unknown>;
		expect(ai.status).toBe("error");
		expect(ai.error).toContain("Network failure");
	});

	it("masks the API key in the response", async () => {
		mockFetchOk();

		const result = await callGetSettings({
			openaiApiKey: "sk-test-abc123def456",
		});

		const ai = result.ai as Record<string, unknown>;
		expect(typeof ai.apiKey).toBe("string");
		expect(ai.apiKey).not.toContain("sk-test-abc123def456");
		expect((ai.apiKey as string).startsWith("sk-t")).toBe(true);
		expect(ai.apiKey as string).toContain("•");
	});

	it("returns configured embedding model", async () => {
		mockFetchOk();

		const result = await callGetSettings({
			openaiApiKey: "sk-test",
			embeddingModel: "text-embedding-ada-002",
		});

		const ai = result.ai as Record<string, unknown>;
		expect(ai.model).toBe("text-embedding-ada-002");
	});

	it("defaults model to text-embedding-3-small", async () => {
		const result = await callGetSettings({});

		const ai = result.ai as Record<string, unknown>;
		expect(ai.model).toBe("text-embedding-3-small");
	});

	it("prefers OpenAI when both keys are set", async () => {
		mockFetchOk();

		const result = await callGetSettings({
			openaiApiKey: "sk-openai",
			openrouterApiKey: "sk-or-key",
		});

		const ai = result.ai as Record<string, unknown>;
		expect(ai.provider).toBe("openai");
	});
});

// ── API URL routing ──────────────────────────────────────────────────────────

describe("getSettings — API URL routing", () => {
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

// ── Stats ────────────────────────────────────────────────────────────────────

describe("getSettings — stats", () => {
	it("returns embeddings count from controller", async () => {
		const result = await callGetSettings({}, { embeddingsCount: 500 });
		expect(result.embeddingsCount).toBe(500);
	});

	it("returns zero when no embeddings exist", async () => {
		const result = await callGetSettings({}, { embeddingsCount: 0 });
		expect(result.embeddingsCount).toBe(0);
	});
});
