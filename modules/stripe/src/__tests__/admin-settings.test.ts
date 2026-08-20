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
const DEFAULT_WEBHOOK_SECRET = "whsec_admin_test";

function callGetSettings(opts: Record<string, unknown>) {
	const options = Object.hasOwn(opts, "webhookSecret")
		? opts
		: { ...opts, webhookSecret: DEFAULT_WEBHOOK_SECRET };
	return handler({ context: { options } });
}

function mockFetchOk(body: Record<string, unknown>) {
	vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
		new Response(JSON.stringify(body), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		}),
	);
}

function mockFetchError(status: number, body: Record<string, unknown>) {
	vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
		new Response(JSON.stringify(body), {
			status,
			headers: { "Content-Type": "application/json" },
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

// ── status — live connection verification ───────────────────────────────────

describe("getSettings — status (live verification)", () => {
	it('returns "connected" with accountName when Stripe API responds OK', async () => {
		mockFetchOk({
			id: "acct_123",
			business_profile: { name: "Test Store" },
		});
		const result = await callGetSettings({ apiKey: "sk_test_abc123def456" });
		expect(result.status).toBe("connected");
		expect(result.accountName).toBe("Test Store");
	});

	it("falls back to account id when business_profile.name is null", async () => {
		mockFetchOk({ id: "acct_456", business_profile: { name: null } });
		const result = await callGetSettings({ apiKey: "sk_test_abc123def456" });
		expect(result.status).toBe("connected");
		expect(result.accountName).toBe("acct_456");
	});

	it('returns "error" when Stripe API rejects the key', async () => {
		mockFetchError(401, {
			error: {
				message: "Invalid API Key provided",
				type: "invalid_request_error",
			},
		});
		const result = await callGetSettings({ apiKey: "sk_test_invalid" });
		expect(result.status).toBe("error");
		expect(result.error).toContain("Invalid API Key");
	});

	it('returns "error" when fetch throws a network error', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Network failure"),
		);
		const result = await callGetSettings({ apiKey: "sk_test_abc123def456" });
		expect(result.status).toBe("error");
		expect(result.error).toContain("Network failure");
	});

	it('returns "not_configured" when apiKey is empty', async () => {
		const result = await callGetSettings({ apiKey: "" });
		expect(result.status).toBe("not_configured");
		expect(result.accountName).toBeUndefined();
		expect(result.error).toBeUndefined();
	});

	it('returns "not_configured" when apiKey is missing', async () => {
		const result = await callGetSettings({});
		expect(result.status).toBe("not_configured");
	});

	it('returns "not_configured" when apiKey is a non-string value', async () => {
		const result = await callGetSettings({ apiKey: 12345 });
		expect(result.status).toBe("not_configured");
	});

	it('returns "not_configured" and does not connect without webhook verification', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const result = await callGetSettings({
			apiKey: "sk_test_abc123def456",
			webhookSecret: "",
		});
		expect(result.status).toBe("not_configured");
		expect(result.ready).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

// ── apiKeyMasked ─────────────────────────────────────────────────────────────

describe("getSettings — apiKeyMasked", () => {
	it("returns null when no apiKey is present", async () => {
		const result = await callGetSettings({});
		expect(result.apiKeyMasked).toBeNull();
	});

	it("returns null when apiKey is an empty string", async () => {
		const result = await callGetSettings({ apiKey: "" });
		expect(result.apiKeyMasked).toBeNull();
	});

	it('returns "****" for short keys (8 chars or fewer)', async () => {
		mockFetchOk({ id: "acct_1" });
		const result = await callGetSettings({ apiKey: "sk_short" });
		expect(result.apiKeyMasked).toBe("****");
	});

	it("masks correctly for longer keys (first 7 chars + asterisks)", async () => {
		mockFetchOk({ id: "acct_1" });
		const result = await callGetSettings({ apiKey: "sk_test_abc" });
		expect(result.apiKeyMasked).toBe("sk_test****");
	});

	it("caps asterisks at 20 for very long keys", async () => {
		mockFetchOk({ id: "acct_1" });
		const longKey = `sk_live_${"a".repeat(42)}`;
		const result = await callGetSettings({ apiKey: longKey });
		expect(result.apiKeyMasked).toBe(`sk_live********************`);
		const asterisks = (result.apiKeyMasked as string).slice(7);
		expect(asterisks.length).toBe(20);
	});
});

// ── apiKeyMode ───────────────────────────────────────────────────────────────

describe("getSettings — apiKeyMode", () => {
	it('returns "live" for sk_live_ prefix', async () => {
		mockFetchOk({ id: "acct_1" });
		const result = await callGetSettings({
			apiKey: "sk_live_abc123def456ghi",
		});
		expect(result.apiKeyMode).toBe("live");
	});

	it('returns "test" for sk_test_ prefix', async () => {
		mockFetchOk({ id: "acct_1" });
		const result = await callGetSettings({
			apiKey: "sk_test_abc123def456ghi",
		});
		expect(result.apiKeyMode).toBe("test");
	});

	it('returns "unknown" for other prefixes', async () => {
		mockFetchOk({ id: "acct_1" });
		const result = await callGetSettings({
			apiKey: "rk_live_abc123def456ghi",
		});
		expect(result.apiKeyMode).toBe("unknown");
	});

	it('returns "unknown" when apiKey is empty', async () => {
		const result = await callGetSettings({ apiKey: "" });
		expect(result.apiKeyMode).toBe("unknown");
	});
});

// ── webhookSecretConfigured ──────────────────────────────────────────────────

describe("getSettings — webhookSecretConfigured", () => {
	it("returns true when webhookSecret is present", async () => {
		mockFetchOk({ id: "acct_1" });
		const result = await callGetSettings({
			apiKey: "sk_test_key",
			webhookSecret: "whsec_abc123",
		});
		expect(result.webhookSecretConfigured).toBe(true);
	});

	it("returns false when webhookSecret is an empty string", async () => {
		mockFetchOk({ id: "acct_1" });
		const result = await callGetSettings({
			apiKey: "sk_test_key",
			webhookSecret: "",
		});
		expect(result.webhookSecretConfigured).toBe(false);
	});

	it("returns false when webhookSecret is missing", async () => {
		mockFetchOk({ id: "acct_1" });
		const result = await callGetSettings({
			apiKey: "sk_test_key",
			webhookSecret: undefined,
		});
		expect(result.webhookSecretConfigured).toBe(false);
	});
});

// ── webhookSecretMasked ──────────────────────────────────────────────────────

describe("getSettings — webhookSecretMasked", () => {
	it("returns null when no webhookSecret is present", async () => {
		mockFetchOk({ id: "acct_1" });
		const result = await callGetSettings({
			apiKey: "sk_test_key",
			webhookSecret: undefined,
		});
		expect(result.webhookSecretMasked).toBeNull();
	});

	it("masks correctly for a present webhook secret", async () => {
		mockFetchOk({ id: "acct_1" });
		const result = await callGetSettings({
			apiKey: "sk_test_key",
			webhookSecret: "whsec_abc123",
		});
		expect(result.webhookSecretMasked).toBe("whsec_a*****");
	});
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("getSettings — edge cases", () => {
	it("handles non-string option values gracefully", async () => {
		const result = await callGetSettings({
			apiKey: undefined,
			webhookSecret: undefined,
		});
		expect(result.status).toBe("not_configured");
		expect(result.apiKeyMasked).toBeNull();
		expect(result.webhookSecretConfigured).toBe(false);
		expect(result.webhookSecretMasked).toBeNull();
	});
});
