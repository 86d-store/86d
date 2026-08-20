import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveSettings } from "../admin/endpoints/get-settings";

function meResponse(overrides: Record<string, unknown> = {}) {
	return new Response(
		JSON.stringify({
			data: {
				id: "2244994945",
				name: "Example Store",
				username: "examplestore",
				...overrides,
			},
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

describe("x-shop settings — connection verification", () => {
	it('returns "not_configured" when no credentials are supplied', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const result = await resolveSettings({});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.merchantId).toBeNull();
		expect(result.apiKey).toBeNull();
		expect(result.username).toBeUndefined();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "not_configured" when credentials are partial', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const result = await resolveSettings({ apiKey: "key12345678" });

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.apiKey).toContain("key123");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "connected" with live account metadata on success', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(meResponse());

		const result = await resolveSettings({
			apiKey: "abcdefghijklmnop",
			apiSecret: "secret-xyz",
			accessToken: "at-oauth2-token",
			merchantId: "merch-001",
		});

		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
		expect(result.username).toBe("examplestore");
		expect(result.name).toBe("Example Store");
		expect(result.userId).toBe("2244994945");
		expect(result.merchantId).toBe("merch-001");
		expect(result.error).toBeUndefined();

		const [[url, init]] = fetchSpy.mock.calls;
		expect(String(url)).toContain("https://api.twitter.com/2/users/me");
		const headers = (init as RequestInit | undefined)?.headers as
			| Record<string, string>
			| undefined;
		expect(headers?.Authorization).toBe("Bearer at-oauth2-token");
	});

	it('returns "error" when X rejects the access token', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					title: "Unauthorized",
					type: "about:blank",
					status: 401,
					detail: "Unauthorized",
				}),
				{ status: 401, headers: { "Content-Type": "application/json" } },
			),
		);

		const result = await resolveSettings({
			apiKey: "key",
			apiSecret: "secret",
			accessToken: "expired-token",
		});

		expect(result.status).toBe("error");
		expect(result.error).toBe("Unauthorized");
		expect(result.configured).toBe(true);
	});

	it('returns "error" when X is unreachable', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("ECONNREFUSED"),
		);

		const result = await resolveSettings({
			apiKey: "key",
			apiSecret: "secret",
			accessToken: "token",
		});

		expect(result.status).toBe("error");
		expect(result.error).toContain("ECONNREFUSED");
	});

	it('returns "error" with HTTP fallback when response is not JSON', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response("Service Unavailable", { status: 503 }),
		);

		const result = await resolveSettings({
			apiKey: "key",
			apiSecret: "secret",
			accessToken: "token",
		});

		expect(result.status).toBe("error");
		expect(result.error).toBe("HTTP 503");
	});

	it("masks the api key in the response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(meResponse());

		const result = await resolveSettings({
			apiKey: "verylongapikey12345",
			apiSecret: "secret",
			accessToken: "at-token",
		});

		const masked = String(result.apiKey ?? "");
		expect(masked).not.toContain("apikey12345");
		expect(masked.startsWith("verylo")).toBe(true);
		expect(masked).toContain("•");
	});

	it("requires apiKey, apiSecret, and accessToken for configured status", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		expect(
			(await resolveSettings({ apiKey: "k", apiSecret: "s" })).configured,
		).toBe(false);
		expect(
			(await resolveSettings({ apiKey: "k", accessToken: "a" })).configured,
		).toBe(false);
		expect(
			(await resolveSettings({ apiSecret: "s", accessToken: "a" })).configured,
		).toBe(false);

		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
