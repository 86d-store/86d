import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";

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
	accessToken?: string;
	adAccountId?: string;
	catalogId?: string;
}) {
	const endpoint = createGetSettingsEndpoint(options);
	const handler = extractHandler(endpoint);
	return handler({ context: {} });
}

function userAccountResponse(overrides: Record<string, unknown> = {}) {
	return new Response(
		JSON.stringify({
			account_type: "BUSINESS",
			profile_image: "https://i.pinimg.com/avatar.jpg",
			website_url: "https://store.example.com",
			username: "examplestore",
			business_name: "Example Store",
			board_count: 12,
			pin_count: 340,
			follower_count: 2500,
			following_count: 180,
			monthly_views: 45000,
			...overrides,
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Pinterest Shop settings — connection verification", () => {
	it('returns "connected" with live account metadata on success', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(userAccountResponse());

		const result = await callSettings({
			accessToken: "pina_AaBbCcDdEeFfGgHh1234567890",
			adAccountId: "549764106778",
			catalogId: "2680195032751",
		});

		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
		expect(result.error).toBeUndefined();
		expect(result.username).toBe("examplestore");
		expect(result.accountType).toBe("BUSINESS");
		expect(result.adAccountId).toBe("549764106778");
		expect(result.catalogId).toBe("2680195032751");

		const [[url, init]] = fetchSpy.mock.calls;
		expect(String(url)).toBe("https://api.pinterest.com/v5/user_account");
		expect((init as RequestInit | undefined)?.method).toBe("GET");
	});

	it('returns "not_configured" when accessToken is missing', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await callSettings({});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.username).toBeUndefined();
		expect(result.accountType).toBeUndefined();
		expect(result.accessToken).toBeNull();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "error" when Pinterest rejects the token', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					code: 2,
					message: "Authentication failed.",
				}),
				{ status: 401, headers: { "Content-Type": "application/json" } },
			),
		);

		const result = await callSettings({
			accessToken: "pina_expired_or_revoked_token",
		});

		expect(result.status).toBe("error");
		expect(result.error).toBe("Authentication failed.");
		expect(result.configured).toBe(true);
	});

	it('returns "error" when Pinterest is unreachable', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("ECONNREFUSED"),
		);

		const result = await callSettings({
			accessToken: "pina_token",
		});

		expect(result.status).toBe("error");
		expect(result.error).toContain("ECONNREFUSED");
	});

	it('returns "error" with HTTP fallback when Pinterest returns non-JSON', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response("Service Unavailable", { status: 503 }),
		);

		const result = await callSettings({
			accessToken: "pina_token",
		});

		expect(result.status).toBe("error");
		expect(result.error).toBe("HTTP 503");
	});

	it("masks the access token in the response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(userAccountResponse());

		const result = await callSettings({
			accessToken: "pina_AaBbCcDdEeFfGgHh1234567890",
		});

		const masked = String(result.accessToken ?? "");
		expect(masked).not.toContain("AaBbCcDdEeFfGgHh1234567890");
		expect(masked.startsWith("pina_A")).toBe(true);
		expect(masked).toContain("•");
	});

	it("defaults accountType to PINNER when Pinterest omits it", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			userAccountResponse({ account_type: undefined, username: "solo" }),
		);

		const result = await callSettings({
			accessToken: "pina_token",
		});

		expect(result.status).toBe("connected");
		expect(result.username).toBe("solo");
		expect(result.accountType).toBe("PINNER");
	});
});
