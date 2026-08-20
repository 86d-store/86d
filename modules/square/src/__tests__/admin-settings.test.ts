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
const DEFAULT_SIGNATURE_KEY = "square-admin-signature";
const DEFAULT_NOTIFICATION_URL = "https://example.com/api/store/square/webhook";

function callSettings(opts: Record<string, unknown>) {
	const options = {
		...(!Object.hasOwn(opts, "webhookSignatureKey")
			? { webhookSignatureKey: DEFAULT_SIGNATURE_KEY }
			: {}),
		...(!Object.hasOwn(opts, "webhookNotificationUrl")
			? { webhookNotificationUrl: DEFAULT_NOTIFICATION_URL }
			: {}),
		...opts,
	};
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
	it('returns "connected" with locationCount when Square API responds OK', async () => {
		mockFetchOk({
			locations: [{ id: "LOC_1" }, { id: "LOC_2" }],
		});
		const result = await callSettings({ accessToken: "sq_token_abc123" });
		expect(result.status).toBe("connected");
		expect(result.locationCount).toBe(2);
	});

	it('returns "error" when Square API rejects the token', async () => {
		mockFetchError(401, {
			errors: [
				{
					detail: "Could not find developer application.",
					category: "AUTHENTICATION_ERROR",
					code: "UNAUTHORIZED",
				},
			],
		});
		const result = await callSettings({ accessToken: "sq_bad_token" });
		expect(result.status).toBe("error");
		expect(result.error).toContain("Could not find developer application");
	});

	it('returns "error" when fetch throws a network error', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Network failure"),
		);
		const result = await callSettings({ accessToken: "sq_token_abc123" });
		expect(result.status).toBe("error");
		expect(result.error).toContain("Network failure");
	});

	it('returns "not_configured" when accessToken is empty string', async () => {
		const result = await callSettings({ accessToken: "" });
		expect(result.status).toBe("not_configured");
	});

	it('returns "not_configured" when accessToken is non-string value', async () => {
		const result = await callSettings({ accessToken: 12345 });
		expect(result.status).toBe("not_configured");
	});

	it('returns "not_configured" when accessToken is missing', async () => {
		const result = await callSettings({});
		expect(result.status).toBe("not_configured");
	});

	it('returns "not_configured" unless both webhook values are present', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const result = await callSettings({
			accessToken: "sq_token_abc123",
			webhookSignatureKey: "signature-key",
			webhookNotificationUrl: "",
		});
		expect(result.status).toBe("not_configured");
		expect(result.ready).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

// ── accessTokenMasked ────────────────────────────────────────────────────────

describe("getSettings — accessTokenMasked", () => {
	it("returns null when no accessToken", async () => {
		const result = await callSettings({});
		expect(result.accessTokenMasked).toBeNull();
	});

	it("returns null when accessToken is empty string", async () => {
		const result = await callSettings({ accessToken: "" });
		expect(result.accessTokenMasked).toBeNull();
	});

	it('returns "****" for short tokens (8 chars or fewer)', async () => {
		mockFetchOk({ locations: [] });
		const result = await callSettings({ accessToken: "abcdefgh" });
		expect(result.accessTokenMasked).toBe("****");
	});

	it("masks correctly for longer tokens (shows first 7 chars)", async () => {
		mockFetchOk({ locations: [] });
		const result = await callSettings({ accessToken: "abcdefghijkl" });
		expect(result.accessTokenMasked).toBe("abcdefg*****");
	});

	it("caps asterisks at 20 for very long tokens", async () => {
		mockFetchOk({ locations: [] });
		const longToken = `abcdefg${"x".repeat(33)}`;
		const result = await callSettings({ accessToken: longToken });
		expect(result.accessTokenMasked).toBe(`abcdefg${"*".repeat(20)}`);
	});
});

// ── webhookSignatureConfigured ───────────────────────────────────────────────

describe("getSettings — webhookSignatureConfigured", () => {
	it("returns true when webhookSignatureKey is present", async () => {
		mockFetchOk({ locations: [] });
		const result = await callSettings({
			accessToken: "sq_tok_abcdef123",
			webhookSignatureKey: "sig_key_12345678901",
		});
		expect(result.webhookSignatureConfigured).toBe(true);
	});

	it("returns false when webhookSignatureKey is empty", async () => {
		mockFetchOk({ locations: [] });
		const result = await callSettings({
			accessToken: "sq_tok_abcdef123",
			webhookSignatureKey: "",
		});
		expect(result.webhookSignatureConfigured).toBe(false);
	});

	it("returns false when webhookSignatureKey is missing", async () => {
		mockFetchOk({ locations: [] });
		const result = await callSettings({
			accessToken: "sq_tok_abcdef123",
			webhookSignatureKey: undefined,
		});
		expect(result.webhookSignatureConfigured).toBe(false);
	});
});

// ── webhookSignatureKeyMasked ────────────────────────────────────────────────

describe("getSettings — webhookSignatureKeyMasked", () => {
	it("returns null when no webhookSignatureKey", async () => {
		mockFetchOk({ locations: [] });
		const result = await callSettings({
			accessToken: "sq_tok_abcdef123",
			webhookSignatureKey: undefined,
		});
		expect(result.webhookSignatureKeyMasked).toBeNull();
	});

	it("masks correctly when key is present", async () => {
		mockFetchOk({ locations: [] });
		const result = await callSettings({
			accessToken: "sq_tok_abcdef123",
			webhookSignatureKey: "webhook_secret_key_123",
		});
		expect(result.webhookSignatureKeyMasked).toBe(`webhook${"*".repeat(15)}`);
	});
});

// ── webhookNotificationUrl ───────────────────────────────────────────────────

describe("getSettings — webhookNotificationUrl", () => {
	it("returns the URL when present", async () => {
		mockFetchOk({ locations: [] });
		const result = await callSettings({
			accessToken: "sq_tok_abcdef123",
			webhookNotificationUrl: "https://example.com/api/square/webhook",
		});
		expect(result.webhookNotificationUrl).toBe(
			"https://example.com/api/square/webhook",
		);
	});

	it("returns null when webhookNotificationUrl is empty", async () => {
		mockFetchOk({ locations: [] });
		const result = await callSettings({
			accessToken: "sq_tok_abcdef123",
			webhookNotificationUrl: "",
		});
		expect(result.webhookNotificationUrl).toBeNull();
	});

	it("returns null when webhookNotificationUrl is missing", async () => {
		mockFetchOk({ locations: [] });
		const result = await callSettings({
			accessToken: "sq_tok_abcdef123",
			webhookNotificationUrl: undefined,
		});
		expect(result.webhookNotificationUrl).toBeNull();
	});
});

// ── edge cases ───────────────────────────────────────────────────────────────

describe("getSettings — edge cases", () => {
	it("handles non-string option values gracefully", async () => {
		const result = await callSettings({
			accessToken: 999,
			webhookSignatureKey: null,
			webhookNotificationUrl: false,
		});
		expect(result.status).toBe("not_configured");
		expect(result.accessTokenMasked).toBeNull();
		expect(result.webhookSignatureConfigured).toBe(false);
		expect(result.webhookSignatureKeyMasked).toBeNull();
		expect(result.webhookNotificationUrl).toBeNull();
	});
});
