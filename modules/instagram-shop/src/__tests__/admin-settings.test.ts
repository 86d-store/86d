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
	businessId?: string;
	catalogId?: string;
	commerceAccountId?: string;
}) {
	const endpoint = createGetSettingsEndpoint(options);
	const handler = extractHandler(endpoint);
	return handler({ context: {} });
}

function listProductsSuccess() {
	return new Response(
		JSON.stringify({
			data: [
				{
					id: "100000000001",
					retailer_id: "sku-1",
					name: "Test Product",
				},
			],
			paging: { cursors: { before: "b", after: "a" } },
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

const CREDS = {
	accessToken: "EAABwzLixnjYBOZC123abcLongLivedBusinessToken",
	businessId: "17841401234567890",
	catalogId: "987654321098765",
	commerceAccountId: "555555555555555",
};

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Instagram Shop settings — connection verification", () => {
	it('returns "connected" when Meta accepts the credentials', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(listProductsSuccess());

		const result = await callSettings({ ...CREDS });

		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
		expect(result.error).toBeUndefined();
		expect(result.businessId).toBe(CREDS.businessId);
		expect(result.catalogId).toBe(CREDS.catalogId);
		expect(result.commerceAccountId).toBe(CREDS.commerceAccountId);

		const [[url]] = fetchSpy.mock.calls;
		expect(String(url)).toContain("graph.facebook.com");
		expect(String(url)).toContain(`/${CREDS.catalogId}/products`);
		expect(String(url)).toContain(
			`access_token=${encodeURIComponent(CREDS.accessToken)}`,
		);
	});

	it('returns "not_configured" when no credentials are provided', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await callSettings({});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.accessToken).toBeNull();
		expect(result.businessId).toBeNull();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "not_configured" when business ID is missing', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await callSettings({
			accessToken: CREDS.accessToken,
			catalogId: CREDS.catalogId,
			commerceAccountId: CREDS.commerceAccountId,
		});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "not_configured" when commerce account is missing', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await callSettings({
			accessToken: CREDS.accessToken,
			businessId: CREDS.businessId,
			catalogId: CREDS.catalogId,
		});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "error" when Meta rejects the access token', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: {
						message:
							"Error validating access token: The session has been invalidated because the user changed their password.",
						type: "OAuthException",
						code: 190,
					},
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			),
		);

		const result = await callSettings({ ...CREDS });

		expect(result.status).toBe("error");
		expect(String(result.error)).toContain("invalidated");
		expect(result.configured).toBe(true);
	});

	it('returns "error" when the catalog is unreachable', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: {
						message:
							"(#10) Application does not have permission for this action",
						type: "OAuthException",
						code: 10,
					},
				}),
				{ status: 403, headers: { "Content-Type": "application/json" } },
			),
		);

		const result = await callSettings({ ...CREDS });

		expect(result.status).toBe("error");
		expect(String(result.error)).toContain("permission");
	});

	it('returns "error" when the network call throws', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("ECONNREFUSED"),
		);

		const result = await callSettings({ ...CREDS });

		expect(result.status).toBe("error");
		expect(String(result.error)).toContain("ECONNREFUSED");
	});

	it("masks the access token in the response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(listProductsSuccess());

		const result = await callSettings({ ...CREDS });

		const masked = String(result.accessToken ?? "");
		expect(masked).not.toBe(CREDS.accessToken);
		expect(masked.startsWith(CREDS.accessToken.slice(0, 8))).toBe(true);
		expect(masked.endsWith("...")).toBe(true);
	});

	it("falls back to a generic error when Meta omits a JSON body", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response("<html>500</html>", {
				status: 500,
				headers: { "Content-Type": "text/html" },
			}),
		);

		const result = await callSettings({ ...CREDS });

		expect(result.status).toBe("error");
		expect(String(result.error)).toContain("HTTP 500");
	});
});
