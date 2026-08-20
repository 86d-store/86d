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
	customerId?: string;
	webhookSigningKey?: string;
}) {
	const endpoint = createGetSettingsEndpoint({
		webhookSigningKey: "test-webhook-signing-key",
		...options,
	});
	const handler = extractHandler(endpoint);
	return handler({ context: {} });
}

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ── Connection verification ───────────────────────────────────────────────────

describe("Uber Direct settings — connection verification", () => {
	it("is unavailable without the dedicated webhook signing key", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const result = await callSettings({
			clientId: "CLIENT_ID_123",
			clientSecret: "CLIENT_SECRET_XYZ",
			customerId: "CUSTOMER_ABC456",
			webhookSigningKey: "",
		});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.webhookConfigured).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "connected" when OAuth token is obtained successfully', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					access_token: "Bearer eyJtest",
					token_type: "Bearer",
					expires_in: 2592000,
					scope: "eats.deliveries",
				}),
				{ status: 200 },
			),
		);

		const result = await callSettings({
			clientId: "CLIENT_ID_123",
			clientSecret: "CLIENT_SECRET_XYZ",
			customerId: "CUSTOMER_ABC456",
		});

		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
		expect(result.error).toBeUndefined();
		expect(result.accountName).toContain("Uber Direct");
	});

	it('returns "not_configured" when no credentials are provided', async () => {
		const result = await callSettings({});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it('returns "not_configured" when only partial credentials are provided', async () => {
		const result = await callSettings({
			clientId: "CLIENT_ID_123",
			// missing clientSecret and customerId
		});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it('returns "error" when OAuth token request fails', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: "invalid_client",
					error_description: "The client credentials are invalid",
				}),
				{ status: 401 },
			),
		);

		const result = await callSettings({
			clientId: "bad-client",
			clientSecret: "bad-secret",
			customerId: "CUSTOMER_ABC456",
		});

		expect(result.status).toBe("error");
		expect(result.configured).toBe(true);
		expect(typeof result.error).toBe("string");
	});

	it('returns "error" when network request fails', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Network failure"),
		);

		const result = await callSettings({
			clientId: "CLIENT_ID_123",
			clientSecret: "CLIENT_SECRET_XYZ",
			customerId: "CUSTOMER_ABC456",
		});

		expect(result.status).toBe("error");
		expect(result.error).toContain("Network failure");
	});

	it("masks client ID in the response", async () => {
		const result = await callSettings({
			clientId: "CLIENT_ID_ABCDEF12",
			// partial credentials — won't attempt connection
		});

		expect(result.clientIdMasked).toMatch(/\*/);
		expect(result.clientIdMasked).not.toBe("CLIENT_ID_ABCDEF12");
	});

	it("masks customer ID in the response", async () => {
		const result = await callSettings({
			customerId: "CUSTOMER_XYZ789ABC",
		});

		expect(result.customerIdMasked).toMatch(/\*/);
		expect(result.customerIdMasked).not.toBe("CUSTOMER_XYZ789ABC");
	});

	it("returns null masks when credentials are absent", async () => {
		const result = await callSettings({});

		expect(result.clientIdMasked).toBeNull();
		expect(result.customerIdMasked).toBeNull();
	});
});
