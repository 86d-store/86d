import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";

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

function callSettings(options: {
	apiKey?: string;
	shopId?: string;
	accessToken?: string;
}) {
	const endpoint = createGetSettingsEndpoint(options);
	const handler = extractHandler(endpoint);
	return handler({ context: {} });
}

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ── Connection verification ──────────────────────────────────────────────────

describe("Etsy settings — connection verification", () => {
	it('returns "connected" when Etsy API responds OK', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({ count: 1, results: [{ listing_id: 123 }] }),
				{ status: 200 },
			),
		);

		const result = await callSettings({
			apiKey: "etsy-api-key-abc123",
			shopId: "my-shop",
			accessToken: "token-xyz",
		});

		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
		expect(result.error).toBeUndefined();
	});

	it('returns "not_configured" when credentials are missing', async () => {
		const result = await callSettings({});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it('returns "not_configured" when only apiKey is set', async () => {
		const result = await callSettings({ apiKey: "key" });

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it('returns "error" when Etsy API rejects credentials', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: "invalid_token",
					error_description: "Access token is invalid",
				}),
				{ status: 401 },
			),
		);

		const result = await callSettings({
			apiKey: "bad-key",
			shopId: "shop-1",
			accessToken: "bad-token",
		});

		expect(result.status).toBe("error");
		expect(result.error).toContain("Access token is invalid");
	});

	it('returns "error" when Etsy API is unreachable', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("ECONNREFUSED"),
		);

		const result = await callSettings({
			apiKey: "key-123",
			shopId: "shop-1",
			accessToken: "token-1",
		});

		expect(result.status).toBe("error");
		expect(result.error).toContain("ECONNREFUSED");
	});

	it("masks the API key in the response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify({ count: 0, results: [] }), {
				status: 200,
			}),
		);

		const result = await callSettings({
			apiKey: "etsy-api-key-abc123456",
			shopId: "shop-1",
			accessToken: "token-1",
		});

		expect(result.apiKey).toBe("etsy-api...");
		expect(result.apiKey).not.toContain("etsy-api-key-abc123456");
	});

	it("returns shopId in the response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify({ count: 0, results: [] }), {
				status: 200,
			}),
		);

		const result = await callSettings({
			apiKey: "etsy-api-key-abc123456",
			shopId: "my-cool-shop",
			accessToken: "token-1",
		});

		expect(result.shopId).toBe("my-cool-shop");
	});
});
