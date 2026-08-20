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
	taxjarApiKey?: string;
	taxjarSandbox?: boolean;
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

// ── Realistic TaxJar /categories response fixture ─────────────────────────────

const TAXJAR_CATEGORIES_RESPONSE = {
	categories: [
		{
			product_tax_code: "20010",
			name: "Food & Groceries",
			description:
				"Food for human consumption, generally food bought in a grocery store.",
		},
		{
			product_tax_code: "81100",
			name: "Software as a Service",
			description: "Cloud-based software and related services.",
		},
		{
			product_tax_code: "99999",
			name: "Other",
			description: "Other exempt items.",
		},
	],
};

// ── Connection verification ───────────────────────────────────────────────────

describe("Tax (TaxJar) settings — connection verification", () => {
	it('returns "connected" with category count when TaxJar API responds OK', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify(TAXJAR_CATEGORIES_RESPONSE), { status: 200 }),
		);

		const result = await callSettings({
			taxjarApiKey: "5da1b7422373c0f6be4cd30ab4d7e08a",
		});

		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
		expect(result.error).toBeUndefined();
		expect(result.accountName).toContain("TaxJar");
		expect(result.accountName).toContain("3 tax categories");
	});

	it('returns "not_configured" when no API key is provided', async () => {
		const result = await callSettings({});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it('returns "not_configured" for an empty API key string', async () => {
		const result = await callSettings({ taxjarApiKey: "" });

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it('returns "error" when TaxJar returns 401 Unauthorized', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					status: 401,
					error: "Unauthorized",
					detail: "Not authorized for route 'GET /categories'",
				}),
				{ status: 401 },
			),
		);

		const result = await callSettings({
			taxjarApiKey: "invalid-api-key",
		});

		expect(result.status).toBe("error");
		expect(result.configured).toBe(true);
		expect(typeof result.error).toBe("string");
	});

	it('returns "error" when network request fails', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Network failure"),
		);

		const result = await callSettings({
			taxjarApiKey: "5da1b7422373c0f6be4cd30ab4d7e08a",
		});

		expect(result.status).toBe("error");
		expect(result.error).toContain("Network failure");
	});

	it("masks API key in the response", async () => {
		const result = await callSettings({
			taxjarApiKey: "5da1b7422373c0f6be4cd30ab4d7e08a",
		});

		expect(result.apiKeyMasked).toMatch(/\*/);
		expect(result.apiKeyMasked).not.toBe("5da1b7422373c0f6be4cd30ab4d7e08a");
	});

	it("returns null API key mask when no key is configured", async () => {
		const result = await callSettings({});
		expect(result.apiKeyMasked).toBeNull();
	});

	it("defaults sandbox to false (production mode)", async () => {
		const result = await callSettings({});
		expect(result.sandbox).toBe(false);
	});

	it("respects explicit sandbox: true setting", async () => {
		const result = await callSettings({
			taxjarApiKey: "test-key",
			taxjarSandbox: true,
		});
		expect(result.sandbox).toBe(true);
	});
});
