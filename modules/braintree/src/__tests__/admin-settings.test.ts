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

function invoke(opts: Record<string, unknown>) {
	return handler({ context: { options: opts } });
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
	it('returns "connected" when Braintree client token generation succeeds', async () => {
		mockFetchOk({ clientToken: { value: "eyJ0..." } });
		const result = await invoke({
			merchantId: "m_123456789",
			publicKey: "pk_123456789",
			privateKey: "sk_123456789",
		});
		expect(result.status).toBe("connected");
		expect(result.ready).toBe(true);
		expect(result.webhookVerificationConfigured).toBe(true);
	});

	it('returns "error" when Braintree API rejects credentials', async () => {
		mockFetchError(401, {
			apiErrorResponse: { message: "Authentication failed" },
		});
		const result = await invoke({
			merchantId: "m_bad",
			publicKey: "pk_bad",
			privateKey: "sk_bad",
		});
		expect(result.status).toBe("error");
		expect(result.error).toContain("Authentication failed");
	});

	it('returns "error" when fetch throws a network error', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Network failure"),
		);
		const result = await invoke({
			merchantId: "m_123456789",
			publicKey: "pk_123456789",
			privateKey: "sk_123456789",
		});
		expect(result.status).toBe("error");
		expect(result.error).toContain("Network failure");
	});

	it('returns "not_configured" when merchantId is missing', async () => {
		const result = await invoke({
			publicKey: "pk_123456789",
			privateKey: "sk_123456789",
		});
		expect(result.status).toBe("not_configured");
	});

	it('returns "not_configured" when publicKey is missing', async () => {
		const result = await invoke({
			merchantId: "m_123456789",
			privateKey: "sk_123456789",
		});
		expect(result.status).toBe("not_configured");
	});

	it('returns "not_configured" when privateKey is missing', async () => {
		const result = await invoke({
			merchantId: "m_123456789",
			publicKey: "pk_123456789",
		});
		expect(result.status).toBe("not_configured");
		expect(result.ready).toBe(false);
		expect(result.webhookVerificationConfigured).toBe(false);
	});

	it('returns "not_configured" when all keys are missing', async () => {
		const result = await invoke({});
		expect(result.status).toBe("not_configured");
	});

	it('returns "not_configured" when keys are empty strings', async () => {
		const result = await invoke({
			merchantId: "",
			publicKey: "",
			privateKey: "",
		});
		expect(result.status).toBe("not_configured");
	});

	it('returns "not_configured" when keys are non-string types', async () => {
		const result = await invoke({
			merchantId: 12345,
			publicKey: true,
			privateKey: null,
		});
		expect(result.status).toBe("not_configured");
	});
});

// ── merchantIdMasked ─────────────────────────────────────────────────────────

describe("getSettings — merchantIdMasked", () => {
	it("returns null when no merchantId", async () => {
		const result = await invoke({
			publicKey: "pk_123456789",
			privateKey: "sk_123456789",
		});
		expect(result.merchantIdMasked).toBeNull();
	});

	it('returns "****" for short IDs (<=8 chars)', async () => {
		mockFetchOk({ clientToken: { value: "tok" } });
		const result = await invoke({
			merchantId: "abcdefgh",
			publicKey: "pk_123456789",
			privateKey: "sk_123456789",
		});
		expect(result.merchantIdMasked).toBe("****");
	});

	it("masks correctly for longer IDs (shows first 7 chars)", async () => {
		mockFetchOk({ clientToken: { value: "tok" } });
		const result = await invoke({
			merchantId: "merchant_id_long_value",
			publicKey: "pk_123456789",
			privateKey: "sk_123456789",
		});
		expect(result.merchantIdMasked).toMatch(/^merchan\*+$/);
	});

	it("masks 9-character merchant ID with first 7 + 2 asterisks", async () => {
		mockFetchOk({ clientToken: { value: "tok" } });
		const result = await invoke({
			merchantId: "123456789",
			publicKey: "pk_123456789",
			privateKey: "sk_123456789",
		});
		expect(result.merchantIdMasked).toBe("1234567**");
	});
});

// ── publicKeyMasked ──────────────────────────────────────────────────────────

describe("getSettings — publicKeyMasked", () => {
	it("returns null when no publicKey", async () => {
		const result = await invoke({
			merchantId: "m_123456789",
			privateKey: "sk_123456789",
		});
		expect(result.publicKeyMasked).toBeNull();
	});

	it("masks correctly for longer keys", async () => {
		mockFetchOk({ clientToken: { value: "tok" } });
		const result = await invoke({
			merchantId: "m_123456789",
			publicKey: "pk_test_key_value_long",
			privateKey: "sk_123456789",
		});
		expect((result.publicKeyMasked as string).startsWith("pk_test")).toBe(true);
		expect((result.publicKeyMasked as string).includes("*")).toBe(true);
	});
});

// ── privateKeyMasked ─────────────────────────────────────────────────────────

describe("getSettings — privateKeyMasked", () => {
	it("returns null when no privateKey", async () => {
		const result = await invoke({
			merchantId: "m_123456789",
			publicKey: "pk_123456789",
		});
		expect(result.privateKeyMasked).toBeNull();
	});

	it("masks correctly for longer keys", async () => {
		mockFetchOk({ clientToken: { value: "tok" } });
		const result = await invoke({
			merchantId: "m_123456789",
			publicKey: "pk_123456789",
			privateKey: "sk_secret_private_key_value",
		});
		expect((result.privateKeyMasked as string).startsWith("sk_secr")).toBe(
			true,
		);
		expect((result.privateKeyMasked as string).includes("*")).toBe(true);
	});
});

// ── mode ─────────────────────────────────────────────────────────────────────

describe("getSettings — mode", () => {
	it('returns "sandbox" when sandbox is "true"', async () => {
		mockFetchOk({ clientToken: { value: "tok" } });
		const result = await invoke({
			merchantId: "m_123456789",
			publicKey: "pk_123456789",
			privateKey: "sk_123456789",
			sandbox: "true",
		});
		expect(result.mode).toBe("sandbox");
	});

	it('returns "sandbox" when sandbox is "1"', async () => {
		mockFetchOk({ clientToken: { value: "tok" } });
		const result = await invoke({
			merchantId: "m_123456789",
			publicKey: "pk_123456789",
			privateKey: "sk_123456789",
			sandbox: "1",
		});
		expect(result.mode).toBe("sandbox");
	});

	it('returns "production" when sandbox is empty string', async () => {
		mockFetchOk({ clientToken: { value: "tok" } });
		const result = await invoke({
			merchantId: "m_123456789",
			publicKey: "pk_123456789",
			privateKey: "sk_123456789",
			sandbox: "",
		});
		expect(result.mode).toBe("production");
	});

	it('returns "production" when sandbox is missing', async () => {
		mockFetchOk({ clientToken: { value: "tok" } });
		const result = await invoke({
			merchantId: "m_123456789",
			publicKey: "pk_123456789",
			privateKey: "sk_123456789",
		});
		expect(result.mode).toBe("production");
	});

	it('returns "production" when sandbox is non-string type', async () => {
		mockFetchOk({ clientToken: { value: "tok" } });
		const result = await invoke({
			merchantId: "m_123456789",
			publicKey: "pk_123456789",
			privateKey: "sk_123456789",
			sandbox: true,
		});
		expect(result.mode).toBe("production");
	});
});
