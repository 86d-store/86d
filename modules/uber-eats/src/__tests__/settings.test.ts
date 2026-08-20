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
	restaurantId?: string;
}) {
	const endpoint = createGetSettingsEndpoint(options);
	const handler = extractHandler(endpoint);
	return handler({ context: {} });
}

const ALL_SCOPES = [
	"eats.store",
	"eats.store.status.write",
	"eats.order",
	"eats.store.orders.read",
];

function tokenResponse(scopes: string[] = ALL_SCOPES) {
	return new Response(
		JSON.stringify({
			access_token: "test-access-token",
			token_type: "Bearer",
			expires_in: 2592000,
			scope: scopes.join(" "),
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

describe("uber-eats settings — connection verification", () => {
	it('returns "connected" when Uber returns a token', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(tokenResponse());

		const result = await callSettings({
			clientId: "client-abc-123",
			clientSecret: "secret-xyz-456",
			restaurantId: "store-id-789",
		});

		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
		expect(result.missingScopes).toEqual([]);
		expect(result.error).toBeUndefined();

		const [[url]] = fetchSpy.mock.calls;
		expect(String(url)).toBe("https://auth.uber.com/oauth/v2/token");
	});

	it("surfaces missing scopes when Uber grants a subset", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			tokenResponse(["eats.store", "eats.order"]),
		);

		const result = await callSettings({
			clientId: "c",
			clientSecret: "s",
			restaurantId: "r",
		});

		expect(result.status).toBe("connected");
		expect(result.missingScopes).toEqual([
			"eats.store.status.write",
			"eats.store.orders.read",
		]);
	});

	it('returns "not_configured" when credentials are missing', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await callSettings({});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.clientIdMasked).toBeNull();
		expect(result.clientSecretMasked).toBeNull();
		expect(result.restaurantIdMasked).toBeNull();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "not_configured" when only clientId is supplied', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await callSettings({
			clientId: "client-abc-123",
		});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.clientIdMasked).toBe("client-*******");
		expect(result.clientSecretMasked).toBeNull();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "error" when Uber rejects the credentials', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: "invalid_client",
					error_description: "The client credentials are invalid",
				}),
				{ status: 401, headers: { "Content-Type": "application/json" } },
			),
		);

		const result = await callSettings({
			clientId: "c",
			clientSecret: "s",
			restaurantId: "r",
		});

		expect(result.status).toBe("error");
		expect(result.error).toBe("The client credentials are invalid");
		expect(result.configured).toBe(true);
	});

	it('returns "error" when Uber is unreachable', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("ECONNREFUSED"),
		);

		const result = await callSettings({
			clientId: "c",
			clientSecret: "s",
			restaurantId: "r",
		});

		expect(result.status).toBe("error");
		expect(result.error).toContain("ECONNREFUSED");
	});

	it("masks credentials in the response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(tokenResponse());

		const result = await callSettings({
			clientId: "client-abc-123",
			clientSecret: "secret-xyz-456",
			restaurantId: "store-id-789",
		});

		expect(result.clientIdMasked).toBe("client-*******");
		expect(result.clientSecretMasked).toBe("secret-*******");
		expect(result.restaurantIdMasked).toBe("store-i*****");
	});

	it("masks short keys as ****", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(tokenResponse());

		const result = await callSettings({
			clientId: "abc",
			clientSecret: "def",
			restaurantId: "ghi",
		});

		expect(result.clientIdMasked).toBe("****");
		expect(result.clientSecretMasked).toBe("****");
		expect(result.restaurantIdMasked).toBe("****");
	});

	it("exposes the webhook endpoint path", async () => {
		const result = await callSettings({});
		expect(result.webhookUrl).toBe("/api/uber-eats/webhook");
	});
});
