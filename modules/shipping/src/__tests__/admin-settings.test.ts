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
	easypostApiKey?: string;
	easypostTestMode?: boolean;
	easypostWebhookSecret?: string;
}) {
	const endpoint = createGetSettingsEndpoint({
		easypostWebhookSecret: "test-webhook-secret",
		...options,
	});
	const handler = extractHandler(endpoint);
	return handler({
		context: {
			controllers: {
				shippingV2: {
					getConnection: vi.fn().mockResolvedValue(null),
				},
			},
		},
	});
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_USER = { id: "user_abc", name: "My Account", email: null };
const VALID_API_KEY = "EZTKabc12345678";

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ── Connection verification ───────────────────────────────────────────────────

describe("Shipping settings — connection verification", () => {
	it("is unavailable without the EasyPost webhook secret", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await callSettings({
			easypostApiKey: VALID_API_KEY,
			easypostWebhookSecret: "",
		});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.webhookConfigured).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "connected" when EasyPost API responds OK', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify(MOCK_USER), { status: 200 }),
		);

		const result = await callSettings({ easypostApiKey: VALID_API_KEY });

		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
		expect(result.error).toBeUndefined();
	});

	it("includes accountName from the user object on success", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify(MOCK_USER), { status: 200 }),
		);

		const result = await callSettings({ easypostApiKey: VALID_API_KEY });

		expect(result.accountName).toBe("My Account");
	});

	it("falls back to email when user name is null", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					id: "user_abc",
					name: null,
					email: "me@example.com",
				}),
				{ status: 200 },
			),
		);

		const result = await callSettings({ easypostApiKey: VALID_API_KEY });

		expect(result.accountName).toBe("me@example.com");
	});

	it("falls back to user id when both name and email are null", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({ id: "user_abc", name: null, email: null }),
				{ status: 200 },
			),
		);

		const result = await callSettings({ easypostApiKey: VALID_API_KEY });

		expect(result.accountName).toBe("user_abc");
	});

	it('returns "not_configured" when no API key is provided', async () => {
		const result = await callSettings({});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.error).toBeUndefined();
	});

	it('returns "not_configured" when API key is an empty string', async () => {
		const result = await callSettings({ easypostApiKey: "" });

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it('returns "error" when API returns 401 Unauthorized', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: { code: "UNAUTHORIZED", message: "Invalid API key" },
				}),
				{ status: 401 },
			),
		);

		const result = await callSettings({ easypostApiKey: VALID_API_KEY });

		expect(result.status).toBe("error");
		expect(result.configured).toBe(true);
		expect(typeof result.error).toBe("string");
	});

	it('returns "error" when network request fails', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Network failure"),
		);

		const result = await callSettings({ easypostApiKey: VALID_API_KEY });

		expect(result.status).toBe("error");
		expect(result.configured).toBe(true);
		expect(result.error).toContain("Network failure");
	});
});

// ── API key masking ───────────────────────────────────────────────────────────

describe("Shipping settings — API key masking", () => {
	it("masks the API key in the response when a key is configured", async () => {
		const result = await callSettings({ easypostApiKey: VALID_API_KEY });

		expect(typeof result.apiKeyMasked).toBe("string");
		expect(result.apiKeyMasked).toMatch(/\*/);
		expect(result.apiKeyMasked).not.toBe(VALID_API_KEY);
	});

	it("preserves the first 8 characters of the API key in the mask", async () => {
		const result = await callSettings({ easypostApiKey: VALID_API_KEY });

		expect(result.apiKeyMasked).toMatch(/^EZTKabc1/);
	});

	it("replaces remaining characters with asterisks", async () => {
		// Key longer than 8 chars — remainder should be asterisks
		const result = await callSettings({
			easypostApiKey: "EZTK12345678901234",
		});

		const masked = result.apiKeyMasked as string;
		const suffix = masked.slice(8);
		expect(/^\*+$/.test(suffix)).toBe(true);
	});

	it("returns '****' for keys with 8 or fewer characters", async () => {
		const result = await callSettings({ easypostApiKey: "EZTK1234" });

		expect(result.apiKeyMasked).toBe("****");
	});

	it("returns null apiKeyMasked when no API key is provided", async () => {
		const result = await callSettings({});

		expect(result.apiKeyMasked).toBeNull();
	});

	it("does not fetch when no key is provided (no network call made)", async () => {
		const spy = vi.spyOn(globalThis, "fetch");

		await callSettings({});

		expect(spy).not.toHaveBeenCalled();
	});
});

// ── testMode defaults ─────────────────────────────────────────────────────────

describe("Shipping settings — testMode", () => {
	it("defaults testMode to true when not specified", async () => {
		const result = await callSettings({});

		expect(result.testMode).toBe(true);
	});

	it("respects explicit testMode: false", async () => {
		const result = await callSettings({ easypostTestMode: false });

		expect(result.testMode).toBe(false);
	});

	it("respects explicit testMode: true", async () => {
		const result = await callSettings({ easypostTestMode: true });

		expect(result.testMode).toBe(true);
	});

	it("calls GET /users regardless of testMode when key is configured", async () => {
		const spy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(JSON.stringify(MOCK_USER), { status: 200 }),
			);

		await callSettings({
			easypostApiKey: VALID_API_KEY,
			easypostTestMode: false,
		});

		expect(spy).toHaveBeenCalledOnce();
		const [url] = spy.mock.calls[0] as [string, ...unknown[]];
		expect(url).toContain("/users");
	});
});

// ── Response shape completeness ───────────────────────────────────────────────

describe("Shipping settings — response shape", () => {
	it("returns all expected fields when not configured", async () => {
		const result = await callSettings({});

		expect(result).toMatchObject({
			status: "not_configured",
			configured: false,
			testMode: true,
			apiKeyMasked: null,
		});
		expect("error" in result || result.error === undefined).toBe(true);
	});

	it("returns all expected fields when connected", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify(MOCK_USER), { status: 200 }),
		);

		const result = await callSettings({ easypostApiKey: VALID_API_KEY });

		expect(result).toMatchObject({
			status: "connected",
			configured: true,
			testMode: true,
		});
		expect(typeof result.apiKeyMasked).toBe("string");
		expect(typeof result.accountName).toBe("string");
	});

	it("returns all expected fields on error", async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Connection refused"),
		);

		const result = await callSettings({ easypostApiKey: VALID_API_KEY });

		expect(result).toMatchObject({
			status: "error",
			configured: true,
			testMode: true,
		});
		expect(typeof result.error).toBe("string");
		expect(typeof result.apiKeyMasked).toBe("string");
	});
});
