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
const DEFAULT_WEBHOOK_ID = "WH-admin-test";

function callGetSettings(opts: Record<string, unknown>) {
	const options = Object.hasOwn(opts, "webhookId")
		? opts
		: { ...opts, webhookId: DEFAULT_WEBHOOK_ID };
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
	it('returns "connected" when PayPal OAuth token succeeds', async () => {
		mockFetchOk({ access_token: "A21AAE...", expires_in: 32400 });
		const result = await callGetSettings({
			clientId: "AaBbCcDdEeFf",
			clientSecret: "secret_12345678",
		});
		expect(result.status).toBe("connected");
	});

	it('returns "error" when PayPal OAuth rejects credentials', async () => {
		mockFetchError(401, {
			name: "AUTHENTICATION_FAILURE",
			message:
				"Authentication failed due to invalid authentication credentials",
		});
		const result = await callGetSettings({
			clientId: "AaBbCcDdEeFf",
			clientSecret: "bad_secret",
		});
		expect(result.status).toBe("error");
		expect(result.error).toContain("Authentication failed");
	});

	it('returns "error" when fetch throws a network error', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Network failure"),
		);
		const result = await callGetSettings({
			clientId: "AaBbCcDdEeFf",
			clientSecret: "secret_12345678",
		});
		expect(result.status).toBe("error");
		expect(result.error).toContain("Network failure");
	});

	it('returns "not_configured" when clientId is missing', async () => {
		const result = await callGetSettings({
			clientSecret: "secret_12345678",
		});
		expect(result.status).toBe("not_configured");
	});

	it('returns "not_configured" when clientSecret is missing', async () => {
		const result = await callGetSettings({
			clientId: "AaBbCcDdEeFf",
		});
		expect(result.status).toBe("not_configured");
	});

	it('returns "not_configured" when both are missing', async () => {
		const result = await callGetSettings({});
		expect(result.status).toBe("not_configured");
	});

	it('returns "not_configured" and does not connect without a webhook ID', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const result = await callGetSettings({
			clientId: "AaBbCcDdEeFf",
			clientSecret: "secret_12345678",
			webhookId: "",
		});
		expect(result.status).toBe("not_configured");
		expect(result.ready).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

// ── clientIdMasked ───────────────────────────────────────────────────────────

describe("getSettings — clientIdMasked", () => {
	it("returns '****' for short IDs (<=8 chars)", async () => {
		mockFetchOk({ access_token: "tok", expires_in: 32400 });
		const result = await callGetSettings({
			clientId: "ABC",
			clientSecret: "secret_12345678",
		});
		expect(result.clientIdMasked).toBe("****");
	});

	it("masks correctly for longer IDs (first 7 chars visible)", async () => {
		mockFetchOk({ access_token: "tok", expires_in: 32400 });
		const result = await callGetSettings({
			clientId: "AaBbCcDdEeFf",
			clientSecret: "secret_12345678",
		});
		expect(result.clientIdMasked).toBe("AaBbCcD*****");
	});

	it("caps asterisks at 20 for very long IDs", async () => {
		mockFetchOk({ access_token: "tok", expires_in: 32400 });
		const longId = `AaBbCcD${"x".repeat(50)}`;
		const result = await callGetSettings({
			clientId: longId,
			clientSecret: "secret_12345678",
		});
		expect(result.clientIdMasked).toBe(`AaBbCcD${"*".repeat(20)}`);
	});

	it("returns null when no clientId provided", async () => {
		const result = await callGetSettings({
			clientSecret: "secret_12345678",
		});
		expect(result.clientIdMasked).toBeNull();
	});
});

// ── clientSecretMasked ───────────────────────────────────────────────────────

describe("getSettings — clientSecretMasked", () => {
	it("returns null when no clientSecret provided", async () => {
		const result = await callGetSettings({
			clientId: "AaBbCcDdEeFf",
		});
		expect(result.clientSecretMasked).toBeNull();
	});

	it("masks clientSecret correctly for longer secrets", async () => {
		mockFetchOk({ access_token: "tok", expires_in: 32400 });
		const result = await callGetSettings({
			clientId: "AaBbCcDdEeFf",
			clientSecret: "secret_12345678",
		});
		expect(result.clientSecretMasked).toBe(`secret_${"*".repeat(8)}`);
	});
});

// ── mode ─────────────────────────────────────────────────────────────────────

describe("getSettings — mode", () => {
	it("returns 'sandbox' when sandbox='true'", async () => {
		mockFetchOk({ access_token: "tok", expires_in: 32400 });
		const result = await callGetSettings({
			clientId: "AaBbCcDdEeFf",
			clientSecret: "secret_12345678",
			sandbox: "true",
		});
		expect(result.mode).toBe("sandbox");
	});

	it("returns 'sandbox' when sandbox='1'", async () => {
		mockFetchOk({ access_token: "tok", expires_in: 32400 });
		const result = await callGetSettings({
			clientId: "AaBbCcDdEeFf",
			clientSecret: "secret_12345678",
			sandbox: "1",
		});
		expect(result.mode).toBe("sandbox");
	});

	it("returns 'live' when sandbox is empty string", async () => {
		mockFetchOk({ access_token: "tok", expires_in: 32400 });
		const result = await callGetSettings({
			clientId: "AaBbCcDdEeFf",
			clientSecret: "secret_12345678",
			sandbox: "",
		});
		expect(result.mode).toBe("live");
	});

	it("returns 'live' when sandbox is not provided", async () => {
		mockFetchOk({ access_token: "tok", expires_in: 32400 });
		const result = await callGetSettings({
			clientId: "AaBbCcDdEeFf",
			clientSecret: "secret_12345678",
		});
		expect(result.mode).toBe("live");
	});
});

// ── webhookId ────────────────────────────────────────────────────────────────

describe("getSettings — webhookId", () => {
	it("returns webhookIdConfigured true when webhookId present", async () => {
		mockFetchOk({ access_token: "tok", expires_in: 32400 });
		const result = await callGetSettings({
			clientId: "AaBbCcDdEeFf",
			clientSecret: "secret_12345678",
			webhookId: "WH-ABCDEFGHIJ",
		});
		expect(result.webhookIdConfigured).toBe(true);
	});

	it("returns webhookIdConfigured false when webhookId empty", async () => {
		mockFetchOk({ access_token: "tok", expires_in: 32400 });
		const result = await callGetSettings({
			clientId: "AaBbCcDdEeFf",
			clientSecret: "secret_12345678",
			webhookId: "",
		});
		expect(result.webhookIdConfigured).toBe(false);
	});

	it("returns webhookIdConfigured false when webhookId not provided", async () => {
		mockFetchOk({ access_token: "tok", expires_in: 32400 });
		const result = await callGetSettings({
			clientId: "AaBbCcDdEeFf",
			clientSecret: "secret_12345678",
			webhookId: undefined,
		});
		expect(result.webhookIdConfigured).toBe(false);
	});

	it("masks webhookId correctly when present", async () => {
		mockFetchOk({ access_token: "tok", expires_in: 32400 });
		const result = await callGetSettings({
			clientId: "AaBbCcDdEeFf",
			clientSecret: "secret_12345678",
			webhookId: "WH-ABCDEFGHIJ",
		});
		expect(result.webhookIdMasked).toBe(`WH-ABCD${"*".repeat(6)}`);
	});
});

// ── non-string option values ─────────────────────────────────────────────────

describe("getSettings — non-string option values", () => {
	it("handles numeric option values gracefully (treated as empty)", async () => {
		const result = await callGetSettings({
			clientId: 12345,
			clientSecret: 67890,
			sandbox: true,
			webhookId: 42,
		});
		expect(result.status).toBe("not_configured");
		expect(result.clientIdMasked).toBeNull();
		expect(result.clientSecretMasked).toBeNull();
		expect(result.mode).toBe("live");
		expect(result.webhookIdConfigured).toBe(false);
		expect(result.webhookIdMasked).toBeNull();
	});
});
