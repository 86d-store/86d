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

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ── Connection status ────────────────────────────────────────────────────────

describe("Toast settings — connection verification", () => {
	it('returns "connected" when Toast API responds OK', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify([{ guid: "menu-1", name: "Lunch", menuGroups: [] }]),
				{ status: 200 },
			),
		);

		const result = await callSettings({
			apiKey: "toast_abcdefghijklmnop",
			restaurantGuid: "guid-1234-5678-abcd",
		});

		expect(result.status).toBe("connected");
		expect(result.menuCount).toBe(1);
		expect(result.configured).toBe(true);
		expect(result.error).toBeUndefined();
	});

	it('returns "connected" with zero menus for empty restaurant', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify([]), { status: 200 }),
		);

		const result = await callSettings({
			apiKey: "toast_abcdefghijklmnop",
			restaurantGuid: "guid-1234-5678-abcd",
		});

		expect(result.status).toBe("connected");
		expect(result.menuCount).toBe(0);
	});

	it('returns "not_configured" when apiKey is missing', async () => {
		const result = await callSettings({
			restaurantGuid: "guid-1234-5678-abcd",
		});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.apiKeyMasked).toBeNull();
	});

	it('returns "not_configured" when restaurantGuid is missing', async () => {
		const result = await callSettings({
			apiKey: "toast_abcdefghijklmnop",
		});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
		expect(result.restaurantGuidMasked).toBeNull();
	});

	it('returns "not_configured" when both are missing', async () => {
		const result = await callSettings({});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it('returns "error" when Toast API rejects credentials', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify({ message: "Unauthorized" }), {
				status: 401,
			}),
		);

		const result = await callSettings({
			apiKey: "toast_invalid",
			restaurantGuid: "guid-invalid",
		});

		expect(result.status).toBe("error");
		expect(result.error).toContain("Unauthorized");
		expect(result.configured).toBe(true);
	});

	it('returns "error" when Toast API is unreachable', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Network failure"),
		);

		const result = await callSettings({
			apiKey: "toast_abcdefghijklmnop",
			restaurantGuid: "guid-1234-5678-abcd",
		});

		expect(result.status).toBe("error");
		expect(result.error).toContain("Network failure");
	});
});

// ── Key masking ──────────────────────────────────────────────────────────────

describe("Toast settings — key masking", () => {
	it("masks API key showing first 7 chars", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify([]), { status: 200 }),
		);

		const result = await callSettings({
			apiKey: "toast_abcdefghijklmnop",
			restaurantGuid: "guid-1234-5678-abcd",
		});

		expect(result.apiKeyMasked).toBe("toast_a***************");
	});

	it("masks short keys as ****", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify([]), { status: 200 }),
		);

		const result = await callSettings({
			apiKey: "short",
			restaurantGuid: "guid-1234-5678-abcd",
		});

		expect(result.apiKeyMasked).toBe("****");
	});

	it("masks restaurant GUID", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify([]), { status: 200 }),
		);

		const result = await callSettings({
			apiKey: "toast_abcdefghijklmnop",
			restaurantGuid: "guid-1234-5678-abcd",
		});

		expect(result.restaurantGuidMasked).not.toBeNull();
		expect(result.restaurantGuidMasked).not.toContain("guid-1234-5678-abcd");
	});
});

// ── Sandbox mode ─────────────────────────────────────────────────────────────

describe("Toast settings — sandbox mode", () => {
	it("defaults sandbox to true", async () => {
		const result = await callSettings({});
		expect(result.sandbox).toBe(true);
	});

	it("respects sandbox=false", async () => {
		const result = await callSettings({
			apiKey: "a",
			sandbox: false,
		});
		expect(result.sandbox).toBe(false);
	});

	it("uses sandbox API URL when sandbox=true", async () => {
		const spy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

		await callSettings({
			apiKey: "toast_key123456789",
			restaurantGuid: "guid-123",
			sandbox: true,
		});

		const [url] = spy.mock.calls[0];
		expect(url).toContain("ws-sandbox-api.toasttab.com");
	});
});
