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
	sellerId?: string;
	clientId?: string;
	clientSecret?: string;
	refreshToken?: string;
	marketplaceId?: string;
	region?: string;
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

// ── Connection verification ──────────────────────────────────────────────────

describe("Amazon settings — connection verification", () => {
	it("reports the integration unavailable while notifications are disabled", async () => {
		const spy = vi.spyOn(globalThis, "fetch");
		// First call: token refresh
		spy.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					access_token: "access-token-123",
					token_type: "bearer",
					expires_in: 3600,
				}),
				{ status: 200 },
			),
		);
		// Second call: searchListings
		spy.mockResolvedValueOnce(
			new Response(JSON.stringify({ items: [], pagination: {} }), {
				status: 200,
			}),
		);

		const result = await callSettings({
			sellerId: "A1B2C3D4E5",
			clientId: "amzn1.application-oa2-client.abc123",
			clientSecret: "secret-xyz",
			refreshToken: "Atzr|refresh-token",
		});

		expect(result.status).toBe("error");
		expect(result.configured).toBe(false);
		expect(result.apiConfigured).toBe(true);
		expect(result.notificationStatus).toBe("disabled");
		expect(result.error).toMatch(/notification.*disabled/i);
	});

	it('returns "not_configured" when no credentials', async () => {
		const result = await callSettings({});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it('returns "not_configured" when partial credentials', async () => {
		const result = await callSettings({
			sellerId: "A1B2C3",
			clientId: "amzn1.app",
		});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it('returns "error" when token refresh fails', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: "invalid_grant",
					error_description: "The refresh token is invalid",
				}),
				{ status: 400 },
			),
		);

		const result = await callSettings({
			sellerId: "A1B2C3D4E5",
			clientId: "amzn1.app",
			clientSecret: "bad-secret",
			refreshToken: "bad-refresh",
		});

		expect(result.status).toBe("error");
		expect(result.configured).toBe(false);
		expect(result.apiConfigured).toBe(true);
	});

	it('returns "error" when API is unreachable', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Network failure"),
		);

		const result = await callSettings({
			sellerId: "A1B2C3D4E5",
			clientId: "amzn1.app",
			clientSecret: "secret",
			refreshToken: "token",
		});

		expect(result.status).toBe("error");
		expect(result.error).toContain("Network failure");
	});

	it("masks client ID in response", async () => {
		const result = await callSettings({
			clientId: "amzn1.application-oa2-client.abc123",
		});

		expect(result.clientId).toBe("amzn1.applic...");
	});

	it("returns region and marketplace", async () => {
		const result = await callSettings({
			region: "EU",
			marketplaceId: "A1F83G8C2ARO7P",
		});

		expect(result.region).toBe("EU");
		expect(result.marketplaceId).toBe("A1F83G8C2ARO7P");
	});

	it("defaults region to NA", async () => {
		const result = await callSettings({});
		expect(result.region).toBe("NA");
	});
});
