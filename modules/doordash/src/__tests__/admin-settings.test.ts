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
	developerId?: string;
	keyId?: string;
	signingSecret?: string;
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

// ── Connection verification ───────────────────────────────────────────────────

describe("DoorDash settings — connection verification", () => {
	it("reports the integration unavailable while webhook ingress is disabled", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify({ list: [], next_offset: null }), {
				status: 200,
			}),
		);

		const result = await callSettings({
			developerId: "dev-abc123",
			keyId: "key-xyz789",
			signingSecret: "dGVzdC1zaWduaW5nLXNlY3JldA==",
		});

		expect(result.status).toBe("error");
		expect(result.configured).toBe(false);
		expect(result.apiConfigured).toBe(true);
		expect(result.webhookConfigured).toBe(false);
		expect(result.error).toMatch(/webhook.*disabled/i);
		expect(result.accountName).toContain("dev-abc");
	});

	it('returns "not_configured" when no credentials are provided', async () => {
		const result = await callSettings({});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it('returns "not_configured" when only partial credentials are provided', async () => {
		const result = await callSettings({
			developerId: "dev-abc123",
			keyId: "key-xyz789",
			// missing signingSecret
		});

		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it('returns "error" when API returns 401 Unauthorized', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify({ message: "Unauthorized" }), {
				status: 401,
			}),
		);

		const result = await callSettings({
			developerId: "dev-abc123",
			keyId: "key-xyz789",
			signingSecret: "bad-secret",
		});

		expect(result.status).toBe("error");
		expect(result.configured).toBe(false);
		expect(result.apiConfigured).toBe(true);
		expect(typeof result.error).toBe("string");
	});

	it('returns "error" when network request fails', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Network failure"),
		);

		const result = await callSettings({
			developerId: "dev-abc123",
			keyId: "key-xyz789",
			signingSecret: "dGVzdC1zaWduaW5nLXNlY3JldA==",
		});

		expect(result.status).toBe("error");
		expect(result.error).toContain("Network failure");
	});

	it("masks developer ID in the response", async () => {
		const result = await callSettings({
			developerId: "dev-abc123def456",
			// no keyId/signingSecret — won't try to connect
		});

		expect(result.developerIdMasked).toMatch(/\*/);
		expect(result.developerIdMasked).not.toBe("dev-abc123def456");
	});

	it("masks key ID in the response", async () => {
		const result = await callSettings({
			keyId: "key-xyz789abc",
		});

		expect(result.keyIdMasked).toMatch(/\*/);
		expect(result.keyIdMasked).not.toBe("key-xyz789abc");
	});

	it("returns null masks when credentials are absent", async () => {
		const result = await callSettings({});

		expect(result.developerIdMasked).toBeNull();
		expect(result.keyIdMasked).toBeNull();
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
