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
	clientId?: string;
	clientSecret?: string;
	channelType?: string;
	sandbox?: boolean;
}) {
	const endpoint = createGetSettingsEndpoint(options);
	const handler = extractHandler(endpoint);
	return handler({ context: {} });
}

function tokenResponse() {
	return new Response(
		JSON.stringify({
			access_token: "test-access-token",
			token_type: "Bearer",
			expires_in: 900,
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

describe("Walmart settings — connection verification", () => {
	it('returns "connected" and "live" mode when Walmart returns a token', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(tokenResponse());

		const result = await callSettings({
			clientId: "clientId-xyz-1234567890abcdef",
			clientSecret: "secret-abc-xyz",
			channelType: "Marketplace",
		});

		expect(result.status).toBe("connected");
		expect(result.mode).toBe("live");
		expect(result.configured).toBe(true);
		expect(result.channelType).toBe("Marketplace");
		expect(result.error).toBeUndefined();

		const [[url]] = fetchSpy.mock.calls;
		expect(String(url)).toBe("https://marketplace.walmartapis.com/v3/token");
	});

	it('returns "connected" with sandbox mode and hits the sandbox token URL', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(tokenResponse());

		const result = await callSettings({
			clientId: "sandbox-client",
			clientSecret: "sandbox-secret",
			sandbox: true,
		});

		expect(result.status).toBe("connected");
		expect(result.mode).toBe("sandbox");
		expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
			"https://sandbox.walmartapis.com/v3/token",
		);
	});

	it('returns "not_configured" when credentials are missing', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const result = await callSettings({});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.clientId).toBeNull();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "not_configured" when only clientId is supplied', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const result = await callSettings({
			clientId: "clientId-only-12345",
		});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "error" when Walmart rejects the credentials', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: "invalid_client",
					error_description: "Client authentication failed",
				}),
				{ status: 401, headers: { "Content-Type": "application/json" } },
			),
		);

		const result = await callSettings({
			clientId: "bad-client",
			clientSecret: "bad-secret",
		});

		expect(result.status).toBe("error");
		expect(result.error).toBe("Client authentication failed");
		expect(result.configured).toBe(true);
	});

	it('returns "error" when Walmart is unreachable', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("ECONNREFUSED"),
		);

		const result = await callSettings({
			clientId: "c",
			clientSecret: "s",
		});

		expect(result.status).toBe("error");
		expect(result.error).toContain("ECONNREFUSED");
	});

	it('returns "error" with HTTP fallback when Walmart returns non-JSON', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response("Service Unavailable", { status: 503 }),
		);

		const result = await callSettings({
			clientId: "c",
			clientSecret: "s",
		});

		expect(result.status).toBe("error");
		expect(result.error).toBe("HTTP 503");
	});

	it("masks the client id in the response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(tokenResponse());

		const result = await callSettings({
			clientId: "clientId-AppName-PRD-abcdef1234-56789012",
			clientSecret: "secret-xyz",
		});

		const masked = String(result.clientId ?? "");
		expect(masked).not.toContain("AppName-PRD-abcdef1234");
		expect(masked.startsWith("clientId-A")).toBe(true);
		expect(masked).toContain("•");
	});

	it("defaults mode to live when sandbox is not set", async () => {
		const result = await callSettings({});
		expect(result.mode).toBe("live");
	});
});
