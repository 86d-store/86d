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
	merchantId?: string;
	apiKey?: string;
	targetCountry?: string;
	contentLanguage?: string;
}) {
	const endpoint = createGetSettingsEndpoint(options);
	const handler = extractHandler(endpoint);
	return handler({ context: {} });
}

function listProductsSuccess() {
	return new Response(
		JSON.stringify({
			kind: "content#productsListResponse",
			resources: [
				{
					id: "online:en:US:sku-1",
					offerId: "sku-1",
					title: "Sample",
					link: "https://example.com/p/1",
					imageLink: "https://example.com/i/1.jpg",
					contentLanguage: "en",
					targetCountry: "US",
					channel: "online",
					availability: "in_stock",
					condition: "new",
					price: { value: "9.99", currency: "USD" },
				},
			],
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

const CREDS = {
	merchantId: "1234567890",
	apiKey: "AIzaSyD-long-google-api-key-string-ABCDEFG",
};

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Google Shopping settings — connection verification", () => {
	it('returns "connected" when Google accepts the credentials', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(listProductsSuccess());

		const result = await callSettings({ ...CREDS });

		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
		expect(result.error).toBeUndefined();
		expect(result.merchantId).toBe(CREDS.merchantId);

		const [[url]] = fetchSpy.mock.calls;
		expect(String(url)).toContain(
			"shoppingcontent.googleapis.com/content/v2.1",
		);
		expect(String(url)).toContain(`/${CREDS.merchantId}/products`);
		expect(String(url)).toContain(`key=${encodeURIComponent(CREDS.apiKey)}`);
	});

	it('returns "not_configured" when no credentials are provided', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await callSettings({});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.merchantId).toBeNull();
		expect(result.apiKey).toBeNull();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "not_configured" when only merchant ID is set', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await callSettings({ merchantId: CREDS.merchantId });

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "error" when Google rejects the API key', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: {
						code: 401,
						message: "API key not valid. Please pass a valid API key.",
						status: "UNAUTHENTICATED",
					},
				}),
				{ status: 401, headers: { "Content-Type": "application/json" } },
			),
		);

		const result = await callSettings({ ...CREDS });

		expect(result.status).toBe("error");
		expect(String(result.error)).toContain("API key not valid");
		expect(result.configured).toBe(true);
	});

	it('returns "error" when the merchant account is inaccessible', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					error: {
						code: 403,
						message: "User does not have access to account 1234567890.",
						status: "PERMISSION_DENIED",
					},
				}),
				{ status: 403, headers: { "Content-Type": "application/json" } },
			),
		);

		const result = await callSettings({ ...CREDS });

		expect(result.status).toBe("error");
		expect(String(result.error)).toContain("does not have access");
	});

	it('returns "error" when the network call throws', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("ECONNREFUSED"),
		);

		const result = await callSettings({ ...CREDS });

		expect(result.status).toBe("error");
		expect(String(result.error)).toContain("ECONNREFUSED");
	});

	it("masks the API key in the response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(listProductsSuccess());

		const result = await callSettings({ ...CREDS });

		const masked = String(result.apiKey ?? "");
		expect(masked).not.toBe(CREDS.apiKey);
		expect(masked.startsWith(CREDS.apiKey.slice(0, 8))).toBe(true);
		expect(masked.endsWith("...")).toBe(true);
	});

	it("applies target country and language defaults when omitted", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(listProductsSuccess());

		const result = await callSettings({ ...CREDS });

		expect(result.targetCountry).toBe("US");
		expect(result.contentLanguage).toBe("en");
	});

	it("preserves configured target country and language", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(listProductsSuccess());

		const result = await callSettings({
			...CREDS,
			targetCountry: "GB",
			contentLanguage: "en-GB",
		});

		expect(result.targetCountry).toBe("GB");
		expect(result.contentLanguage).toBe("en-GB");
	});
});
