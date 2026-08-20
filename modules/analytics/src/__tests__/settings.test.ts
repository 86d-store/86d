import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the analytics settings endpoint.
 *
 * Covers: GTM presence reporting, live Sentry envelope verification,
 * live GA4 Measurement Protocol verification, error propagation, and
 * module factory wiring.
 */

type EndpointResponseOverrides = {
	sentry?: Partial<{
		ok: boolean;
		status: number;
		json: () => Promise<unknown>;
		text: () => Promise<string>;
	}>;
	ga4?: Partial<{
		ok: boolean;
		status: number;
		json: () => Promise<unknown>;
		text: () => Promise<string>;
	}>;
};

interface SettingsResult {
	gtm: { configured: boolean; provider: string; containerId: string | null };
	ga4: {
		status: "connected" | "not_configured" | "error";
		error?: string;
		configured: boolean;
		provider: string;
		measurementId: string | null;
	};
	sentry: {
		status: "connected" | "not_configured" | "error";
		error?: string;
		configured: boolean;
		provider: string;
		dsn: string | null;
		host: string | null;
	};
}

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<SettingsResult> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<SettingsResult>;
}

async function callGetSettings(opts: {
	gtmContainerId?: string | undefined;
	sentryDsn?: string | undefined;
	ga4MeasurementId?: string | undefined;
	ga4ApiSecret?: string | undefined;
}): Promise<SettingsResult> {
	const { createGetSettingsEndpoint } = await import(
		"../admin/endpoints/get-settings"
	);
	const endpoint = createGetSettingsEndpoint(opts);
	const handler = extractHandler(endpoint);
	return handler({ context: { options: opts } });
}

describe("analytics — settings endpoint", () => {
	let fetchSpy: ReturnType<typeof vi.fn>;

	function routedFetch(overrides: EndpointResponseOverrides = {}) {
		return vi.fn().mockImplementation((url: string) => {
			if (url.includes("/envelope/")) {
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve({ id: "evt123" }),
					text: () => Promise.resolve(""),
					...overrides.sentry,
				});
			}
			if (url.includes("debug/mp/collect")) {
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve({ validationMessages: [] }),
					text: () => Promise.resolve(""),
					...overrides.ga4,
				});
			}
			return Promise.reject(new Error(`Unexpected URL: ${url}`));
		});
	}

	beforeEach(() => {
		fetchSpy = routedFetch();
		vi.stubGlobal("fetch", fetchSpy);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("GTM configuration status", () => {
		it("reports GTM as configured when containerId is provided", async () => {
			const result = await callGetSettings({ gtmContainerId: "GTM-XXXXXXX" });
			expect(result.gtm.configured).toBe(true);
			expect(result.gtm.containerId).toBe("GTM-XXXXXXX");
			expect(result.gtm.provider).toBe("google-tag-manager");
		});

		it("reports GTM as not configured when containerId is missing", async () => {
			const result = await callGetSettings({});
			expect(result.gtm.configured).toBe(false);
			expect(result.gtm.containerId).toBeNull();
		});

		it("reports GTM as not configured when containerId is empty string", async () => {
			const result = await callGetSettings({ gtmContainerId: "" });
			expect(result.gtm.configured).toBe(false);
		});
	});

	describe("Sentry DSN validation", () => {
		it("reports connected when the envelope endpoint accepts the test event", async () => {
			const dsn = "https://abc123def@o123.ingest.sentry.io/456";
			const result = await callGetSettings({ sentryDsn: dsn });
			expect(result.sentry.status).toBe("connected");
			expect(result.sentry.configured).toBe(true);
			expect(result.sentry.host).toBe("o123.ingest.sentry.io");
			expect(result.sentry.error).toBeUndefined();

			const envelopeCall = fetchSpy.mock.calls.find(
				(call) =>
					typeof call[0] === "string" &&
					(call[0] as string).includes("/envelope/"),
			);
			expect(envelopeCall).toBeDefined();
			expect(envelopeCall?.[0]).toBe(
				"https://o123.ingest.sentry.io/api/456/envelope/",
			);
		});

		it("reports error when the envelope endpoint rejects the DSN public key", async () => {
			fetchSpy = routedFetch({
				sentry: {
					ok: false,
					status: 401,
					text: () => Promise.resolve(""),
				},
			});
			vi.stubGlobal("fetch", fetchSpy);

			const result = await callGetSettings({
				sentryDsn: "https://bad@o.ingest.sentry.io/1",
			});

			expect(result.sentry.status).toBe("error");
			expect(result.sentry.configured).toBe(false);
			expect(result.sentry.error).toMatch(/401|public key/i);
		});

		it("reports error when the envelope fetch fails with a network error", async () => {
			fetchSpy = vi.fn().mockImplementation((url: string) => {
				if (url.includes("/envelope/"))
					return Promise.reject(new Error("ECONNREFUSED"));
				return Promise.reject(new Error(`Unexpected URL: ${url}`));
			});
			vi.stubGlobal("fetch", fetchSpy);

			const result = await callGetSettings({
				sentryDsn: "https://key@o.ingest.sentry.io/1",
			});

			expect(result.sentry.status).toBe("error");
			expect(result.sentry.error).toBe("ECONNREFUSED");
		});

		it("truncates the Sentry DSN for display", async () => {
			const dsn = "https://abc123def@o123.ingest.sentry.io/456";
			const result = await callGetSettings({ sentryDsn: dsn });
			expect(result.sentry.dsn).toBe(`${dsn.slice(0, 20)}...`);
			expect(result.sentry.dsn).not.toBe(dsn);
		});

		it("reports not_configured when DSN is missing", async () => {
			const result = await callGetSettings({});
			expect(result.sentry.status).toBe("not_configured");
			expect(result.sentry.configured).toBe(false);
			expect(result.sentry.dsn).toBeNull();
		});

		it("reports not_configured when DSN is empty string", async () => {
			const result = await callGetSettings({ sentryDsn: "" });
			expect(result.sentry.status).toBe("not_configured");
			expect(result.sentry.configured).toBe(false);
		});

		it("reports error for an unparseable DSN", async () => {
			const result = await callGetSettings({ sentryDsn: "not a url" });
			expect(result.sentry.status).toBe("error");
			expect(result.sentry.configured).toBe(false);
			expect(result.sentry.error).toMatch(/valid URL/i);
		});

		it("reports error when DSN has no public key", async () => {
			const result = await callGetSettings({
				sentryDsn: "https://o123.ingest.sentry.io/456",
			});
			expect(result.sentry.status).toBe("error");
			expect(result.sentry.error).toMatch(/public key/i);
		});

		it("reports error when DSN has no project id", async () => {
			const result = await callGetSettings({
				sentryDsn: "https://key@o123.ingest.sentry.io/",
			});
			expect(result.sentry.status).toBe("error");
			expect(result.sentry.error).toMatch(/project id/i);
		});

		it("reports error when DSN project id is non-numeric", async () => {
			const result = await callGetSettings({
				sentryDsn: "https://key@o123.ingest.sentry.io/abc",
			});
			expect(result.sentry.status).toBe("error");
			expect(result.sentry.error).toMatch(/project id/i);
		});
	});

	describe("GA4 live verification", () => {
		it("reports connected when the Measurement Protocol returns no validation errors", async () => {
			fetchSpy.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ validationMessages: [] }),
			});

			const result = await callGetSettings({
				ga4MeasurementId: "G-TEST123",
				ga4ApiSecret: "secret-xyz",
			});

			expect(result.ga4.status).toBe("connected");
			expect(result.ga4.configured).toBe(true);
			expect(result.ga4.measurementId).toBe("G-TEST123");
			expect(result.ga4.error).toBeUndefined();

			expect(fetchSpy).toHaveBeenCalledOnce();
			const url = fetchSpy.mock.calls[0][0] as string;
			expect(url).toContain(
				"https://www.google-analytics.com/debug/mp/collect",
			);
			expect(url).toContain("measurement_id=G-TEST123");
			expect(url).toContain("api_secret=secret-xyz");
		});

		it("reports error when the debug endpoint returns validation messages", async () => {
			fetchSpy.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						validationMessages: [{ description: "Measurement ID not found" }],
					}),
			});

			const result = await callGetSettings({
				ga4MeasurementId: "G-WRONG",
				ga4ApiSecret: "secret",
			});

			expect(result.ga4.status).toBe("error");
			expect(result.ga4.error).toBe("Measurement ID not found");
		});

		it("reports error when the debug endpoint returns non-ok", async () => {
			fetchSpy.mockResolvedValueOnce({
				ok: false,
				status: 401,
			});

			const result = await callGetSettings({
				ga4MeasurementId: "G-TEST",
				ga4ApiSecret: "bad-secret",
			});

			expect(result.ga4.status).toBe("error");
			expect(result.ga4.error).toBe("HTTP 401");
		});

		it("reports error when fetch throws", async () => {
			fetchSpy.mockRejectedValueOnce(new Error("Network down"));

			const result = await callGetSettings({
				ga4MeasurementId: "G-TEST",
				ga4ApiSecret: "secret",
			});

			expect(result.ga4.status).toBe("error");
			expect(result.ga4.error).toBe("Network down");
		});

		it("skips verification and reports not_configured when only measurement id is set", async () => {
			const result = await callGetSettings({
				ga4MeasurementId: "G-TEST",
			});

			expect(result.ga4.status).toBe("not_configured");
			expect(result.ga4.configured).toBe(false);
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it("skips verification and reports not_configured when only api secret is set", async () => {
			const result = await callGetSettings({
				ga4ApiSecret: "secret",
			});

			expect(result.ga4.status).toBe("not_configured");
			expect(result.ga4.configured).toBe(false);
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it("reports not_configured when no GA4 options are provided", async () => {
			const result = await callGetSettings({});
			expect(result.ga4.status).toBe("not_configured");
			expect(result.ga4.configured).toBe(false);
			expect(result.ga4.measurementId).toBeNull();
			expect(fetchSpy).not.toHaveBeenCalled();
		});
	});

	describe("combined configuration", () => {
		it("reports all providers as connected when each verifies successfully", async () => {
			fetchSpy.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ validationMessages: [] }),
			});

			const result = await callGetSettings({
				gtmContainerId: "GTM-ABC123",
				sentryDsn: "https://publicKey@sentry.io/123",
				ga4MeasurementId: "G-TEST123",
				ga4ApiSecret: "secret",
			});

			expect(result.gtm.configured).toBe(true);
			expect(result.sentry.status).toBe("connected");
			expect(result.ga4.status).toBe("connected");
		});

		it("reports all providers independently when none are configured", async () => {
			const result = await callGetSettings({});
			expect(result.gtm.configured).toBe(false);
			expect(result.sentry.status).toBe("not_configured");
			expect(result.ga4.status).toBe("not_configured");
		});
	});
});

describe("analytics — module factory settings wiring", () => {
	it("settings endpoint is included when GTM is configured", async () => {
		const { default: analytics } = await import("../index");
		const mod = analytics({ gtmContainerId: "GTM-TEST" });
		expect(mod.endpoints?.admin).toHaveProperty("/admin/analytics/settings");
	});

	it("settings endpoint is included when Sentry is configured", async () => {
		const { default: analytics } = await import("../index");
		const mod = analytics({ sentryDsn: "https://key@sentry.io/1" });
		expect(mod.endpoints?.admin).toHaveProperty("/admin/analytics/settings");
	});

	it("settings endpoint is included when GA4 is configured", async () => {
		const { default: analytics } = await import("../index");
		const mod = analytics({
			ga4MeasurementId: "G-TEST",
			ga4ApiSecret: "secret",
		});
		expect(mod.endpoints?.admin).toHaveProperty("/admin/analytics/settings");
	});

	it("settings endpoint is included when no providers are configured", async () => {
		const { default: analytics } = await import("../index");
		const mod = analytics({});
		expect(mod.endpoints?.admin).toHaveProperty("/admin/analytics/settings");
	});

	it("admin pages always include the Settings page", async () => {
		const { default: analytics } = await import("../index");
		const mod = analytics({});
		const paths = mod.admin?.pages?.map((p) => p.path) ?? [];
		expect(paths).toContain("/admin/analytics/settings");
	});

	it("client-config endpoint is always included in store endpoints", async () => {
		const { default: analytics } = await import("../index");
		const mod = analytics({});
		expect(mod.endpoints?.store).toHaveProperty("/analytics/client-config");
	});

	it("passes gtmContainerId option through to the module", async () => {
		const { default: analytics } = await import("../index");
		const mod = analytics({ gtmContainerId: "GTM-WIRED" });
		expect(mod.options).toMatchObject({ gtmContainerId: "GTM-WIRED" });
	});

	it("passes ga4 options through to the module", async () => {
		const { default: analytics } = await import("../index");
		const mod = analytics({
			ga4MeasurementId: "G-WIRED",
			ga4ApiSecret: "secret123",
		});
		expect(mod.options).toMatchObject({
			ga4MeasurementId: "G-WIRED",
			ga4ApiSecret: "secret123",
		});
	});

	it("passes sentryDsn option through to the module", async () => {
		const { default: analytics } = await import("../index");
		const mod = analytics({ sentryDsn: "https://key@sentry.io/1" });
		expect(mod.options).toMatchObject({
			sentryDsn: "https://key@sentry.io/1",
		});
	});
});
