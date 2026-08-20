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
	gtmContainerId?: string;
	sentryDsn?: string;
	ga4MeasurementId?: string;
	ga4ApiSecret?: string;
}) {
	const endpoint = createGetSettingsEndpoint(options);
	const handler = extractHandler(endpoint);
	return handler({ context: {} }) as Promise<{
		gtm: {
			configured: boolean;
			provider: string;
			containerId: string | null;
		};
		ga4: {
			status: string;
			error: string | undefined;
			configured: boolean;
			provider: string;
			measurementId: string | null;
		};
		sentry: {
			status: string;
			error: string | undefined;
			configured: boolean;
			provider: string;
			dsn: string | null;
			host: string | null;
		};
	}>;
}

// A well-formed Sentry DSN used across multiple tests
const VALID_SENTRY_DSN = "https://abc123@o123456.ingest.sentry.io/7890123";

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ── GTM ───────────────────────────────────────────────────────────────────────

describe("GTM settings", () => {
	it("reports configured=true and returns the containerId when gtmContainerId is set", async () => {
		const result = await callSettings({ gtmContainerId: "GTM-ABCD1234" });

		expect(result.gtm.configured).toBe(true);
		expect(result.gtm.containerId).toBe("GTM-ABCD1234");
		expect(result.gtm.provider).toBe("google-tag-manager");
	});

	it("reports configured=false and null containerId when gtmContainerId is absent", async () => {
		const result = await callSettings({});

		expect(result.gtm.configured).toBe(false);
		expect(result.gtm.containerId).toBeNull();
		expect(result.gtm.provider).toBe("google-tag-manager");
	});

	it("does not make any HTTP calls for GTM (no fetch spy triggered)", async () => {
		const spy = vi.spyOn(globalThis, "fetch");
		await callSettings({ gtmContainerId: "GTM-XYZ999" });

		// GA4 and Sentry are absent so no HTTP call should be made at all
		expect(spy).not.toHaveBeenCalled();
	});
});

// ── GA4 ───────────────────────────────────────────────────────────────────────

describe("GA4 settings — connection verification", () => {
	it('returns status="connected" when the GA4 debug endpoint reports no validation errors', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify({ validationMessages: [] }), {
				status: 200,
			}),
		);

		const result = await callSettings({
			ga4MeasurementId: "G-TESTID123",
			ga4ApiSecret: "test-api-secret",
		});

		expect(result.ga4.status).toBe("connected");
		expect(result.ga4.configured).toBe(true);
		expect(result.ga4.error).toBeUndefined();
		expect(result.ga4.measurementId).toBe("G-TESTID123");
		expect(result.ga4.provider).toBe("ga4-measurement-protocol");
	});

	it('returns status="not_configured" when ga4MeasurementId is missing', async () => {
		const result = await callSettings({ ga4ApiSecret: "test-api-secret" });

		expect(result.ga4.status).toBe("not_configured");
		expect(result.ga4.configured).toBe(false);
		expect(result.ga4.error).toBeUndefined();
	});

	it('returns status="not_configured" when ga4ApiSecret is missing', async () => {
		const result = await callSettings({ ga4MeasurementId: "G-TESTID123" });

		expect(result.ga4.status).toBe("not_configured");
		expect(result.ga4.configured).toBe(false);
		expect(result.ga4.error).toBeUndefined();
	});

	it('returns status="not_configured" when both GA4 credentials are absent', async () => {
		const result = await callSettings({});

		expect(result.ga4.status).toBe("not_configured");
		expect(result.ga4.configured).toBe(false);
		expect(result.ga4.measurementId).toBeNull();
	});

	it('returns status="error" when the GA4 debug endpoint returns validation messages', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					validationMessages: [
						{ description: "Invalid measurement ID format" },
					],
				}),
				{ status: 200 },
			),
		);

		const result = await callSettings({
			ga4MeasurementId: "INVALID",
			ga4ApiSecret: "test-api-secret",
		});

		// configured = true because both credentials are present; status = error
		// because the debug endpoint flagged a validation problem
		expect(result.ga4.status).toBe("error");
		expect(result.ga4.configured).toBe(true);
		expect(result.ga4.error).toBe("Invalid measurement ID format");
	});

	it('returns status="error" when the GA4 HTTP request itself fails', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("Network failure"),
		);

		const result = await callSettings({
			ga4MeasurementId: "G-TESTID123",
			ga4ApiSecret: "test-api-secret",
		});

		// configured = true because both credentials are present
		expect(result.ga4.status).toBe("error");
		expect(result.ga4.configured).toBe(true);
		expect(result.ga4.error).toContain("Network failure");
	});

	it('returns status="error" when the GA4 debug endpoint returns a non-2xx status', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response("Forbidden", { status: 403 }),
		);

		const result = await callSettings({
			ga4MeasurementId: "G-TESTID123",
			ga4ApiSecret: "test-api-secret",
		});

		// configured = true because both credentials are present
		expect(result.ga4.status).toBe("error");
		expect(result.ga4.configured).toBe(true);
	});
});

// ── Sentry ────────────────────────────────────────────────────────────────────

describe("Sentry settings — connection verification", () => {
	it('returns status="connected" when Sentry accepts the envelope with 202', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify({ id: "abc123def456abc123def456abc12345" }), {
				status: 202,
			}),
		);

		const result = await callSettings({ sentryDsn: VALID_SENTRY_DSN });

		expect(result.sentry.status).toBe("connected");
		expect(result.sentry.configured).toBe(true);
		expect(result.sentry.error).toBeUndefined();
		expect(result.sentry.provider).toBe("sentry");
	});

	it("extracts the host from a valid DSN and includes it in the response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify({ id: "abc123def456abc123def456abc12345" }), {
				status: 202,
			}),
		);

		const result = await callSettings({ sentryDsn: VALID_SENTRY_DSN });

		expect(result.sentry.host).toBe("o123456.ingest.sentry.io");
	});

	it("truncates the DSN in the response to avoid leaking the full key", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify({ id: "abc123def456abc123def456abc12345" }), {
				status: 202,
			}),
		);

		const result = await callSettings({ sentryDsn: VALID_SENTRY_DSN });

		expect(result.sentry.dsn).not.toBeNull();
		expect(result.sentry.dsn).toMatch(/\.\.\.$/);
		expect(result.sentry.dsn).not.toBe(VALID_SENTRY_DSN);
	});

	it('returns status="not_configured" when sentryDsn is absent', async () => {
		const result = await callSettings({});

		expect(result.sentry.status).toBe("not_configured");
		expect(result.sentry.configured).toBe(false);
		expect(result.sentry.dsn).toBeNull();
		expect(result.sentry.host).toBeNull();
		expect(result.sentry.error).toBeUndefined();
	});

	it('returns status="error" when the DSN is not a valid URL', async () => {
		const result = await callSettings({ sentryDsn: "not-a-dsn" });

		expect(result.sentry.status).toBe("error");
		expect(result.sentry.configured).toBe(false);
		expect(typeof result.sentry.error).toBe("string");
	});

	it('returns status="error" when the DSN is missing the public key', async () => {
		// No username in the URL
		const result = await callSettings({
			sentryDsn: "https://o123456.ingest.sentry.io/7890123",
		});

		expect(result.sentry.status).toBe("error");
		expect(result.sentry.configured).toBe(false);
		expect(result.sentry.error).toMatch(/public key/i);
	});

	it('returns status="error" when the DSN is missing the project id', async () => {
		const result = await callSettings({
			sentryDsn: "https://abc123@o123456.ingest.sentry.io/",
		});

		expect(result.sentry.status).toBe("error");
		expect(result.sentry.configured).toBe(false);
		expect(result.sentry.error).toMatch(/project id/i);
	});

	it('returns status="error" when the DSN project id is non-numeric', async () => {
		const result = await callSettings({
			sentryDsn: "https://abc123@o123456.ingest.sentry.io/not-a-number",
		});

		expect(result.sentry.status).toBe("error");
		expect(result.sentry.configured).toBe(false);
		expect(result.sentry.error).toMatch(/project id must be numeric/i);
	});

	it('returns status="error" when Sentry returns 401 (bad public key)', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify({ detail: "Invalid api key" }), {
				status: 401,
			}),
		);

		const result = await callSettings({ sentryDsn: VALID_SENTRY_DSN });

		expect(result.sentry.status).toBe("error");
		expect(result.sentry.configured).toBe(false);
		expect(result.sentry.error).toContain("401");
	});

	it('returns status="error" when Sentry returns 429 (rate limited)', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response("", { status: 429 }),
		);

		const result = await callSettings({ sentryDsn: VALID_SENTRY_DSN });

		expect(result.sentry.status).toBe("error");
		expect(result.sentry.configured).toBe(false);
		expect(result.sentry.error).toContain("429");
	});

	it('returns status="error" when the network request to Sentry fails', async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
			new Error("fetch failed"),
		);

		const result = await callSettings({ sentryDsn: VALID_SENTRY_DSN });

		expect(result.sentry.status).toBe("error");
		expect(result.sentry.configured).toBe(false);
		expect(result.sentry.error).toContain("fetch failed");
	});

	it('returns status="error" when Sentry returns an unexpected non-2xx status', async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response("Internal Server Error", { status: 500 }),
		);

		const result = await callSettings({ sentryDsn: VALID_SENTRY_DSN });

		expect(result.sentry.status).toBe("error");
		expect(result.sentry.configured).toBe(false);
		expect(result.sentry.error).toMatch(/500/);
	});
});

// ── Combined providers ────────────────────────────────────────────────────────

describe("Combined provider response shape", () => {
	it("includes all three provider keys in every response", async () => {
		const result = await callSettings({});

		expect(result).toHaveProperty("gtm");
		expect(result).toHaveProperty("ga4");
		expect(result).toHaveProperty("sentry");
	});

	it("each provider key contains the expected fields", async () => {
		const result = await callSettings({});

		expect(result.gtm).toMatchObject({
			configured: expect.any(Boolean),
			provider: "google-tag-manager",
			containerId: null,
		});
		expect(result.ga4).toMatchObject({
			status: "not_configured",
			configured: false,
			provider: "ga4-measurement-protocol",
			measurementId: null,
		});
		expect(result.sentry).toMatchObject({
			status: "not_configured",
			configured: false,
			provider: "sentry",
			dsn: null,
			host: null,
		});
	});

	it("handles all three providers configured simultaneously", async () => {
		// The endpoint processes Sentry first, then GA4.
		// First fetch call goes to the Sentry envelope endpoint, second to GA4 debug endpoint.
		vi.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ id: "abc123def456abc123def456abc12345" }),
					{
						status: 202,
					},
				),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ validationMessages: [] }), {
					status: 200,
				}),
			);

		const result = await callSettings({
			gtmContainerId: "GTM-FULL1234",
			ga4MeasurementId: "G-TESTID123",
			ga4ApiSecret: "test-api-secret",
			sentryDsn: VALID_SENTRY_DSN,
		});

		expect(result.gtm.configured).toBe(true);
		expect(result.gtm.containerId).toBe("GTM-FULL1234");
		expect(result.ga4.status).toBe("connected");
		expect(result.sentry.status).toBe("connected");
	});
});
