import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFromApi } from "../fetch-from-api";
import { DEFAULT_CONFIG } from "../types";

// ── Helpers ──

function createValidApiResponse() {
	return {
		theme: "api-theme",
		name: "API Store",
		favicon: "/api-favicon.ico",
		icon: { light: "/api-icon-light.svg", dark: "/api-icon-dark.svg" },
		logo: { light: "/api-logo-light.svg", dark: "/api-logo-dark.svg" },
		modules: ["@86d-app/cart", "@86d-app/products"],
		variables: {
			light: DEFAULT_CONFIG.variables.light,
			dark: DEFAULT_CONFIG.variables.dark,
		},
	};
}

describe("fetchFromApi", () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.resetAllMocks();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("fetches config from correct URL", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(createValidApiResponse()),
		});

		await fetchFromApi("abc-123", "https://api.86d.app");

		expect(globalThis.fetch).toHaveBeenCalledWith(
			"https://api.86d.app/api/v1/stores/abc-123",
			expect.objectContaining({
				headers: expect.objectContaining({
					"Content-Type": "application/json",
				}),
			}),
		);
	});

	it("strips trailing slash from API base URL", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(createValidApiResponse()),
		});

		await fetchFromApi("abc-123", "https://api.86d.app/");

		expect(globalThis.fetch).toHaveBeenCalledWith(
			"https://api.86d.app/api/v1/stores/abc-123",
			expect.anything(),
		);
	});

	it("does not include an Authorization header", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(createValidApiResponse()),
		});

		await fetchFromApi("abc-123", "https://api.86d.app");

		const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		const headers = call[1].headers as Record<string, string>;
		expect(headers.Authorization).toBeUndefined();
	});

	it("returns merged config with defaults", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(createValidApiResponse()),
		});

		const config = await fetchFromApi("abc-123", "https://api.86d.app");
		expect(config.theme).toBe("api-theme");
		expect(config.name).toBe("API Store");
		expect(config.variables.light).toBeDefined();
		expect(config.variables.dark).toBeDefined();
	});

	it("throws on non-OK response", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 404,
			statusText: "Not Found",
		});

		await expect(fetchFromApi("bad-id", "https://api.86d.app")).rejects.toThrow(
			"86d API request failed: 404 Not Found",
		);
	});

	it("throws on invalid response schema", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ invalid: "data" }),
		});

		await expect(
			fetchFromApi("abc-123", "https://api.86d.app"),
		).rejects.toThrow("Invalid store config from 86d API");
	});

	it.each([
		[
			"Module options",
			{ moduleOptions: { "@86d-app/stripe": { secretKey: "canary" } } },
		],
		[
			"notification settings",
			{ notificationSettings: { fromAddress: "attacker@example.com" } },
		],
		["provider secrets", { providerSecrets: { stripe: "canary" } }],
		["webhook settings", { webhookSettings: { signingSecret: "canary" } }],
	])(
		"fails closed when a compromised response includes %s",
		async (_label, forbiddenField) => {
			const secretCanary = "sk_live_control_plane_must_not_reach_runtime";
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						...createValidApiResponse(),
						...JSON.parse(
							JSON.stringify(forbiddenField).replaceAll("canary", secretCanary),
						),
					}),
			});

			await expect(
				fetchFromApi("abc-123", "https://api.86d.app"),
			).rejects.toThrow("Invalid store config from 86d API");
		},
	);

	it("fills in default theme variables when API response omits them", async () => {
		const responseWithoutVariables = {
			theme: "brisa",
			name: "My Store",
			favicon: "/assets/favicon.svg",
			icon: { light: "/assets/icon/light.svg", dark: "/assets/icon/dark.svg" },
			logo: {
				light: "/assets/logo/light.svg",
				dark: "/assets/logo/dark.svg",
			},
			modules: ["@86d-app/cart", "@86d-app/products"],
		};

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(responseWithoutVariables),
		});

		const config = await fetchFromApi("abc-123", "https://api.86d.app");

		expect(config.name).toBe("My Store");
		expect(config.modules).toEqual(["@86d-app/cart", "@86d-app/products"]);
		expect(config.variables.light.background).toBeDefined();
		expect(config.variables.dark.background).toBeDefined();
	});

	it("merges partial theme variables with defaults when API returns partial variables", async () => {
		const responseWithPartialVariables = {
			theme: "brisa",
			name: "Custom Store",
			favicon: "/assets/favicon.svg",
			icon: { light: "/icon-light.svg", dark: "/icon-dark.svg" },
			logo: { light: "/logo-light.svg", dark: "/logo-dark.svg" },
			variables: {
				light: { background: "oklch(0.99 0.005 240)" },
				dark: { background: "oklch(0.1 0.005 240)" },
			},
		};

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(responseWithPartialVariables),
		});

		const config = await fetchFromApi("abc-123", "https://api.86d.app");

		expect(config.variables.light.background).toBe("oklch(0.99 0.005 240)");
		expect(config.variables.dark.background).toBe("oklch(0.1 0.005 240)");
		expect(config.variables.light.foreground).toBe(
			DEFAULT_CONFIG.variables.light.foreground,
		);
	});

	it("includes billing when API response contains billing info", async () => {
		const responseWithBilling = {
			...createValidApiResponse(),
			billing: {
				plan: "pro",
				status: "active",
				isActive: true,
				periodEnd: "2026-06-14T00:00:00.000Z",
			},
		};

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(responseWithBilling),
		});

		const config = await fetchFromApi("abc-123", "https://api.86d.app");

		expect(config.billing).toEqual({
			plan: "pro",
			status: "active",
			isActive: true,
			periodEnd: "2026-06-14T00:00:00.000Z",
		});
	});

	it("omits billing when API response does not include it", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(createValidApiResponse()),
		});

		const config = await fetchFromApi("abc-123", "https://api.86d.app");

		expect(config.billing).toBeUndefined();
	});

	it("accepts billing without periodEnd", async () => {
		const responseWithBilling = {
			...createValidApiResponse(),
			billing: {
				plan: "starter",
				status: "trialing",
				isActive: true,
			},
		};

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(responseWithBilling),
		});

		const config = await fetchFromApi("abc-123", "https://api.86d.app");

		expect(config.billing?.plan).toBe("starter");
		expect(config.billing?.status).toBe("trialing");
		expect(config.billing?.isActive).toBe(true);
		expect(config.billing?.periodEnd).toBeUndefined();
	});

	it("accepts billing with past_due status", async () => {
		const responseWithBilling = {
			...createValidApiResponse(),
			billing: {
				plan: "pro",
				status: "past_due",
				isActive: false,
			},
		};

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(responseWithBilling),
		});

		const config = await fetchFromApi("abc-123", "https://api.86d.app");

		expect(config.billing?.status).toBe("past_due");
		expect(config.billing?.isActive).toBe(false);
	});

	it("throws on invalid billing status in response", async () => {
		const responseWithInvalidBilling = {
			...createValidApiResponse(),
			billing: {
				plan: "pro",
				status: "unknown_status",
				isActive: true,
			},
		};

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(responseWithInvalidBilling),
		});

		await expect(
			fetchFromApi("abc-123", "https://api.86d.app"),
		).rejects.toThrow("Invalid store config from 86d API");
	});

	it("accepts a coherent Store-scoped entitlement projection", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					...createValidApiResponse(),
					theme: "brisa",
					favicon: "/assets/favicon.svg",
					variables: undefined,
					contractVersion: 2,
					entitlement: {
						version: 1,
						catalogVersion: 1,
						plan: "launch",
						lifecycle: "active",
						currentPeriodEndsAt: "2026-09-13T12:00:00.000Z",
					},
					commerceAvailability: {
						version: 1,
						available: true,
						reason: "entitlement_active",
						evaluatedAt: "2026-08-13T12:00:00.000Z",
						recheckAt: "2026-08-13T12:05:00.000Z",
					},
				}),
		});

		await expect(
			fetchFromApi("abc-123", "https://api.86d.app"),
		).resolves.toMatchObject({
			contractVersion: 2,
			entitlement: { lifecycle: "active", plan: "launch" },
			commerceAvailability: {
				available: true,
				reason: "entitlement_active",
			},
		});
	});

	it.each([
		{
			label: "a suspended entitlement reported as available",
			entitlement: {
				version: 1,
				catalogVersion: 1,
				plan: "launch",
				lifecycle: "suspended",
				suspendAt: "2026-08-13T12:00:00.000Z",
			},
			commerceAvailability: {
				version: 1,
				available: true,
				reason: "entitlement_active",
				evaluatedAt: "2026-08-13T12:00:00.000Z",
				recheckAt: "2026-08-13T12:05:00.000Z",
			},
		},
		{
			label: "a missing entitlement reported as available",
			entitlement: null,
			commerceAvailability: {
				version: 1,
				available: true,
				reason: "entitlement_trialing",
				evaluatedAt: "2026-08-13T12:00:00.000Z",
				recheckAt: "2026-08-13T12:05:00.000Z",
			},
		},
	])("rejects $label", async ({ entitlement, commerceAvailability }) => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					...createValidApiResponse(),
					theme: "brisa",
					favicon: "/assets/favicon.svg",
					variables: undefined,
					contractVersion: 2,
					entitlement,
					commerceAvailability,
				}),
		});

		await expect(
			fetchFromApi("abc-123", "https://api.86d.app"),
		).rejects.toThrow("Invalid store config from 86d API");
	});

	it.each([
		{
			label: "does not advance beyond evaluation time",
			recheckAt: "2026-08-13T12:00:00.000Z",
			currentPeriodEndsAt: "2026-09-13T12:00:00.000Z",
		},
		{
			label: "extends beyond the Store entitlement deadline",
			recheckAt: "2026-09-13T12:00:01.000Z",
			currentPeriodEndsAt: "2026-09-13T12:00:00.000Z",
		},
	])(
		"rejects an availability recheck that $label",
		async ({ recheckAt, currentPeriodEndsAt }) => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						...createValidApiResponse(),
						theme: "brisa",
						favicon: "/assets/favicon.svg",
						variables: undefined,
						contractVersion: 2,
						entitlement: {
							version: 1,
							catalogVersion: 1,
							plan: "launch",
							lifecycle: "active",
							currentPeriodEndsAt,
						},
						commerceAvailability: {
							version: 1,
							available: true,
							reason: "entitlement_active",
							evaluatedAt: "2026-08-13T12:00:00.000Z",
							recheckAt,
						},
					}),
			});

			await expect(
				fetchFromApi("abc-123", "https://api.86d.app"),
			).rejects.toThrow("Invalid store config from 86d API");
		},
	);

	it("bounds an active commerce cache to an earlier scheduled suspension", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					...createValidApiResponse(),
					theme: "brisa",
					favicon: "/assets/favicon.svg",
					variables: undefined,
					contractVersion: 2,
					entitlement: {
						version: 1,
						catalogVersion: 1,
						plan: "launch",
						lifecycle: "active",
						currentPeriodEndsAt: "2026-09-13T12:00:00.000Z",
						suspendAt: "2026-08-14T12:00:00.000Z",
					},
					commerceAvailability: {
						version: 1,
						available: true,
						reason: "entitlement_active",
						evaluatedAt: "2026-08-13T12:00:00.000Z",
						recheckAt: "2026-08-14T12:00:01.000Z",
					},
				}),
		});

		await expect(
			fetchFromApi("abc-123", "https://api.86d.app"),
		).rejects.toThrow("Invalid store config from 86d API");
	});

	it("rejects a trial entitlement without its exact deadline", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					...createValidApiResponse(),
					theme: "brisa",
					favicon: "/assets/favicon.svg",
					variables: undefined,
					contractVersion: 2,
					entitlement: {
						version: 1,
						catalogVersion: 1,
						plan: "launch",
						lifecycle: "trialing",
					},
					commerceAvailability: {
						version: 1,
						available: true,
						reason: "entitlement_trialing",
						evaluatedAt: "2026-08-13T12:00:00.000Z",
						recheckAt: "2026-08-13T12:05:00.000Z",
					},
				}),
		});

		await expect(
			fetchFromApi("abc-123", "https://api.86d.app"),
		).rejects.toThrow("Invalid store config from 86d API");
	});
});
