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
	clientId?: string;
	clientSecret?: string;
	refreshToken?: string;
	siteId?: string;
	currency?: string;
	sandbox?: boolean;
}) {
	const endpoint = createGetSettingsEndpoint(options);
	const handler = extractHandler(endpoint);
	return handler({ context: {} });
}

function tokenResponse(scopes: string[] = []) {
	return new Response(
		JSON.stringify({
			access_token: "access-token-xyz",
			expires_in: 7200,
			token_type: "User Access Token",
			refresh_token_expires_in: 47304000,
			scope: scopes.join(" "),
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

const ALL_SCOPES = [
	"https://api.ebay.com/oauth/api_scope/sell.inventory",
	"https://api.ebay.com/oauth/api_scope/sell.fulfillment",
	"https://api.ebay.com/oauth/api_scope/sell.account",
];

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ── Connection verification ──────────────────────────────────────────────────

describe("eBay settings — connection verification", () => {
	it('returns "connected" and "live" mode when eBay returns a token', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(tokenResponse(ALL_SCOPES));

		const result = await callSettings({
			clientId: "clientId-AppName-PRD-abcd1234-12345678",
			clientSecret: "PRD-abcdef1234567890abcdef12",
			refreshToken:
				"v%5E1.1%23i%5E1%23f%5E0%23r%5E1%23p%5E3%23I%5E3%23t%5Eul41X",
			siteId: "EBAY_US",
		});

		expect(result.status).toBe("connected");
		expect(result.mode).toBe("live");
		expect(result.error).toBeUndefined();
		expect(result.missingScopes).toEqual([]);
		expect(result.configured).toBe(true);

		const [[url, init]] = fetchSpy.mock.calls;
		expect(String(url)).toBe("https://api.ebay.com/identity/v1/oauth2/token");
		const body = String((init as RequestInit | undefined)?.body ?? "");
		expect(body).toContain("grant_type=refresh_token");
		expect(body).toContain("refresh_token=");
	});

	it('returns "connected" with sandbox mode and hits the sandbox token URL', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(tokenResponse(ALL_SCOPES));

		const result = await callSettings({
			clientId: "sandbox-client",
			clientSecret: "sandbox-secret",
			refreshToken: "sandbox-refresh",
			sandbox: true,
		});

		expect(result.status).toBe("connected");
		expect(result.mode).toBe("sandbox");
		expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
			"https://api.sandbox.ebay.com/identity/v1/oauth2/token",
		);
	});

	it("surfaces missing scopes when eBay grants a subset", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			tokenResponse(["https://api.ebay.com/oauth/api_scope/sell.inventory"]),
		);

		const result = await callSettings({
			clientId: "c",
			clientSecret: "s",
			refreshToken: "r",
		});

		expect(result.status).toBe("connected");
		expect(result.missingScopes).toEqual([
			"https://api.ebay.com/oauth/api_scope/sell.fulfillment",
			"https://api.ebay.com/oauth/api_scope/sell.account",
		]);
	});

	it('returns "not_configured" when credentials are missing', async () => {
		const result = await callSettings({});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.clientId).toBeNull();
		expect(result.clientSecretMasked).toBeNull();
		expect(result.refreshTokenMasked).toBeNull();
	});

	it('returns "not_configured" when refreshToken is missing', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await callSettings({
			clientId: "c",
			clientSecret: "s",
		});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "error" when eBay rejects the refresh token', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: "invalid_grant",
					error_description:
						"the provided authorization grant code is invalid, expired, revoked",
				}),
				{ status: 400 },
			),
		);

		const result = await callSettings({
			clientId: "c",
			clientSecret: "s",
			refreshToken: "expired-refresh-token",
		});

		expect(result.status).toBe("error");
		expect(result.error).toContain("invalid");
	});

	it('returns "error" when eBay is unreachable', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("ECONNREFUSED"),
		);

		const result = await callSettings({
			clientId: "c",
			clientSecret: "s",
			refreshToken: "r",
		});

		expect(result.status).toBe("error");
		expect(result.error).toContain("ECONNREFUSED");
	});

	it('returns "error" with HTTP fallback when eBay returns non-JSON body', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response("Internal Server Error", { status: 500 }),
		);

		const result = await callSettings({
			clientId: "c",
			clientSecret: "s",
			refreshToken: "r",
		});

		expect(result.status).toBe("error");
		expect(result.error).toBeTruthy();
	});

	it("masks client credentials in the response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			tokenResponse(ALL_SCOPES),
		);

		const result = await callSettings({
			clientId: "clientId-AppName-PRD-abcdef1234-56789012",
			clientSecret: "PRD-very-secret-value-xyz",
			refreshToken: "v%5E1.1%23i%5E1%23f%5E0%23r%5E1really-long-refresh-token",
		});

		expect(typeof result.clientId).toBe("string");
		const clientIdStr = String(result.clientId ?? "");
		expect(clientIdStr).not.toContain("AppName-PRD-abcdef1234");
		const secretStr = String(result.clientSecretMasked ?? "");
		expect(secretStr).not.toContain("very-secret-value");
		const refreshStr = String(result.refreshTokenMasked ?? "");
		expect(refreshStr).not.toContain("really-long-refresh-token");
	});

	it("reports the configured siteId", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			tokenResponse(ALL_SCOPES),
		);

		const result = await callSettings({
			clientId: "c",
			clientSecret: "s",
			refreshToken: "r",
			siteId: "EBAY_GB",
		});

		expect(result.siteId).toBe("EBAY_GB");
	});

	it("defaults siteId to EBAY_US when not provided", async () => {
		const result = await callSettings({});
		expect(result.siteId).toBe("EBAY_US");
	});
});
