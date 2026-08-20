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
	appKey?: string;
	appSecret?: string;
	accessToken?: string;
	shopId?: string;
	sandbox?: boolean;
}) {
	const endpoint = createGetSettingsEndpoint(options);
	const handler = extractHandler(endpoint);
	return handler({ context: {} });
}

function listProductsSuccess() {
	return new Response(
		JSON.stringify({
			code: 0,
			message: "Success",
			data: {
				total_count: 0,
				list: [],
			},
			request_id: "req-verify-123",
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

const CREDS = {
	appKey: "6abc123def456ghi",
	appSecret: "secret-app-secret-value",
	accessToken: "ROW_AaBbCcDdEeFfGgHh",
	shopId: "7012345678901234567",
};

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("TikTok Shop settings — connection verification", () => {
	it('returns "connected" when TikTok accepts the credentials', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(listProductsSuccess());

		const result = await callSettings({ ...CREDS, sandbox: true });

		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
		expect(result.error).toBeUndefined();
		expect(result.shopId).toBe(CREDS.shopId);
		expect(result.sandbox).toBe(true);

		const [[url, init]] = fetchSpy.mock.calls;
		expect(String(url)).toContain(
			"https://open-api-sandbox.tiktokglobalshop.com/product/202309/products/search",
		);
		expect(String(url)).toContain(`app_key=${CREDS.appKey}`);
		expect(String(url)).toContain(`shop_id=${CREDS.shopId}`);
		expect(String(url)).toContain("sign=");
		expect((init as RequestInit | undefined)?.method).toBe("POST");
	});

	it("targets production when sandbox flag is false", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(listProductsSuccess());

		const result = await callSettings({ ...CREDS, sandbox: false });

		expect(result.status).toBe("connected");
		expect(result.sandbox).toBe(false);

		const [[url]] = fetchSpy.mock.calls;
		expect(String(url)).toContain(
			"https://open-api.tiktokglobalshop.com/product/202309/products/search",
		);
	});

	it('returns "not_configured" when credentials are missing', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await callSettings({});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.appKey).toBeNull();
		expect(result.shopId).toBeNull();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "not_configured" when shopId is missing', async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await callSettings({
			appKey: CREDS.appKey,
			appSecret: CREDS.appSecret,
			accessToken: CREDS.accessToken,
		});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns "error" when TikTok rejects the access token', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					code: 105001,
					message: "The access_token is invalid.",
					request_id: "req-fail-1",
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);

		const result = await callSettings({ ...CREDS });

		expect(result.status).toBe("error");
		expect(String(result.error)).toContain("The access_token is invalid.");
		expect(String(result.error)).toContain("105001");
		expect(result.configured).toBe(true);
	});

	it('returns "error" when TikTok is unreachable', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("ECONNREFUSED"),
		);

		const result = await callSettings({ ...CREDS });

		expect(result.status).toBe("error");
		expect(String(result.error)).toContain("ECONNREFUSED");
	});

	it("masks the app key in the response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(listProductsSuccess());

		const result = await callSettings({ ...CREDS });

		const masked = String(result.appKey ?? "");
		expect(masked).not.toBe(CREDS.appKey);
		expect(masked.startsWith(CREDS.appKey.slice(0, 8))).toBe(true);
		expect(masked.endsWith("...")).toBe(true);
	});

	it("defaults to sandbox environment when flag is omitted", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(listProductsSuccess());

		const result = await callSettings({
			appKey: CREDS.appKey,
			appSecret: CREDS.appSecret,
			accessToken: CREDS.accessToken,
			shopId: CREDS.shopId,
		});

		expect(result.sandbox).toBe(true);
	});
});
