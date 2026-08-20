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
	apiKey?: string;
	restaurantGuid?: string;
	sandbox?: boolean;
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

// ── Realistic Toast API menu response fixture ─────────────────────────────────

const TOAST_MENUS_RESPONSE = [
	{
		guid: "menu-guid-1",
		name: "Dinner Menu",
		description: "Evening dining selections",
		enabled: true,
		menuGroups: [],
	},
	{
		guid: "menu-guid-2",
		name: "Lunch Menu",
		description: "Midday offerings",
		enabled: true,
		menuGroups: [],
	},
];

// ── Connection verification ───────────────────────────────────────────────────

describe("Toast POS settings — connection verification", () => {
	it('returns "connected" with menuCount when Toast API responds OK', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify(TOAST_MENUS_RESPONSE), { status: 200 }),
		);

		const result = await callSettings({
			apiKey: "toast-api-key-123456",
			restaurantGuid: "rest-guid-abc-789",
		});

		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
		expect(result.error).toBeUndefined();
		expect(result.menuCount).toBe(2);
	});

	it('returns "connected" with 0 menus for a restaurant with no menus', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify([]), { status: 200 }),
		);

		const result = await callSettings({
			apiKey: "toast-api-key-123456",
			restaurantGuid: "rest-guid-abc-789",
		});

		expect(result.status).toBe("connected");
		expect(result.menuCount).toBe(0);
	});

	it('returns "not_configured" when no credentials are provided', async () => {
		const result = await callSettings({});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.menuCount).toBeUndefined();
	});

	it('returns "not_configured" when only API key is provided', async () => {
		const result = await callSettings({
			apiKey: "toast-api-key-123456",
			// missing restaurantGuid
		});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it('returns "not_configured" when only restaurant GUID is provided', async () => {
		const result = await callSettings({
			restaurantGuid: "rest-guid-abc-789",
			// missing apiKey
		});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it('returns "error" when API returns 401 Unauthorized', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					status: 401,
					message: "Unauthorized",
					messageCode: "API_KEY_INVALID",
				}),
				{ status: 401 },
			),
		);

		const result = await callSettings({
			apiKey: "invalid-api-key",
			restaurantGuid: "rest-guid-abc-789",
		});

		expect(result.status).toBe("error");
		expect(result.configured).toBe(true);
		expect(typeof result.error).toBe("string");
		expect(result.menuCount).toBeUndefined();
	});

	it('returns "error" when network request fails', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Network failure"),
		);

		const result = await callSettings({
			apiKey: "toast-api-key-123456",
			restaurantGuid: "rest-guid-abc-789",
		});

		expect(result.status).toBe("error");
		expect(result.error).toContain("Network failure");
	});

	it("masks API key in the response", async () => {
		const result = await callSettings({
			apiKey: "toast-api-key-full-value",
		});

		expect(result.apiKeyMasked).toMatch(/\*/);
		expect(result.apiKeyMasked).not.toBe("toast-api-key-full-value");
	});

	it("masks restaurant GUID in the response", async () => {
		const result = await callSettings({
			restaurantGuid: "rest-guid-abc-789-full",
		});

		expect(result.restaurantGuidMasked).toMatch(/\*/);
		expect(result.restaurantGuidMasked).not.toBe("rest-guid-abc-789-full");
	});

	it("returns null masks when credentials are absent", async () => {
		const result = await callSettings({});

		expect(result.apiKeyMasked).toBeNull();
		expect(result.restaurantGuidMasked).toBeNull();
	});

	it("defaults sandbox to true", async () => {
		const result = await callSettings({});
		expect(result.sandbox).toBe(true);
	});

	it("respects explicit sandbox: false setting", async () => {
		const result = await callSettings({ sandbox: false });
		expect(result.sandbox).toBe(false);
	});
});
