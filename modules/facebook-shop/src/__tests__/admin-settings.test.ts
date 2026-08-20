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
	pageId?: string;
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
	accessToken: "EAABwzLixnjYBOZC123abcLongLivedPageToken456",
	pageId: "104729999999991",
	catalogId: "987654321098765",
	commerceAccountId: "555555555555555",
};

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Facebook Shop settings — connection verification", () => {
	it('returns "connected" when Meta accepts the credentials', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(listProductsSuccess());

		const result = await callSettings({ ...CREDS });

		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
		expect(result.error).toBeUndefined();
		expect(result.pageId).toBe(CREDS.pageId);
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
		expect(result.pageId).toBeNull();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "not_configured" when only access token is set', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await callSettings({ accessToken: CREDS.accessToken });

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "not_configured" when commerce account is missing', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await callSettings({
			accessToken: CREDS.accessToken,
			pageId: CREDS.pageId,
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
							"Error validating access token: Session has expired on Monday.",
						type: "OAuthException",
						code: 190,
					},
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			),
		);

		const result = await callSettings({ ...CREDS });

		expect(result.status).toBe("error");
		expect(String(result.error)).toContain("Session has expired");
		expect(result.configured).toBe(true);
	});

	it('returns "error" when catalog is not accessible', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: {
						message: "Unsupported get request. Object does not exist.",
						type: "GraphMethodException",
						code: 100,
					},
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			),
		);

		const result = await callSettings({ ...CREDS });

		expect(result.status).toBe("error");
		expect(String(result.error)).toContain("Object does not exist");
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

	it("falls back to generic error when Meta omits the message body", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response("not json", {
				status: 500,
				headers: { "Content-Type": "text/plain" },
			}),
		);

		const result = await callSettings({ ...CREDS });

		expect(result.status).toBe("error");
		expect(String(result.error)).toContain("HTTP 500");
	});
});
