import { describe, expect, it, vi } from "vitest";
import {
	createManagedRuntimeDiagnosticsClient,
	MANAGED_RUNTIME_DIAGNOSTICS_TELEMETRY,
	type ManagedRuntimeDiagnostics,
	managedRuntimeDiagnosticsSchema,
} from "../managed-runtime-diagnostics";

const diagnostics: ManagedRuntimeDiagnostics = {
	schemaVersion: 1,
	reportId: "6cc87493-8cf1-43cf-8fd5-3f7c48126924",
	observedAt: "2026-08-12T12:00:00.000Z",
	health: "healthy",
	checks: [
		{ component: "runtime", status: "ok" },
		{ component: "database", status: "ok" },
	],
	errors: [],
};

const managedEnvironment = {
	"86D_TELEMETRY": "managed-runtime-diagnostics-v1",
	"86D_STORE_ID": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
	"86D_API_URL": "https://control.example/api",
	"86D_WORKLOAD_CREDENTIAL": `86d_wc_${"c".repeat(24)}.${"s".repeat(43)}`,
};

describe("Managed Runtime Diagnostics", () => {
	it("requires the exact explicit opt-in and complete workload identity", async () => {
		const fetch = vi.fn<typeof globalThis.fetch>();
		for (const configuredValue of [undefined, "", "true", "diagnostics-v1"]) {
			const environment = configuredValue
				? { ...managedEnvironment, "86D_TELEMETRY": configuredValue }
				: { ...managedEnvironment, "86D_TELEMETRY": undefined };
			const client = createManagedRuntimeDiagnosticsClient({
				environment,
				fetch,
			});
			expect(client.enabled).toBe(false);
			await expect(client.report(diagnostics)).resolves.toEqual({
				status: "disabled",
			});
		}
		expect(MANAGED_RUNTIME_DIAGNOSTICS_TELEMETRY).toBe(
			"managed-runtime-diagnostics-v1",
		);
		expect(() =>
			createManagedRuntimeDiagnosticsClient({
				environment: {
					"86D_TELEMETRY": MANAGED_RUNTIME_DIAGNOSTICS_TELEMETRY,
					"86D_STORE_ID": managedEnvironment["86D_STORE_ID"],
				},
				fetch,
			}),
		).toThrow("Managed Runtime diagnostics configuration is invalid");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("defaults off and makes zero Control Plane network calls", async () => {
		const fetch = vi.fn<typeof globalThis.fetch>();
		const client = createManagedRuntimeDiagnosticsClient({
			environment: {},
			fetch,
		});

		expect(client.enabled).toBe(false);
		await expect(client.report(diagnostics)).resolves.toEqual({
			status: "disabled",
		});
		await expect(
			client.report({
				...diagnostics,
				storeId: "untrusted-store-selector",
			} as ManagedRuntimeDiagnostics),
		).rejects.toThrow("Managed Runtime diagnostics payload is invalid");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("posts the exact v1 contract with only workload-token authority", async () => {
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockResolvedValueOnce(
				Response.json({
					access_token: "diagnostics-access-token",
					token_type: "Bearer",
					expires_in: 300,
					scope: "runtime.telemetry:write",
				}),
			)
			.mockResolvedValueOnce(Response.json({ status: "accepted" }));
		const client = createManagedRuntimeDiagnosticsClient({
			environment: managedEnvironment,
			fetch,
		});

		await expect(client.report(diagnostics)).resolves.toEqual({
			status: "accepted",
		});

		expect(fetch).toHaveBeenCalledTimes(2);
		expect(fetch.mock.calls[0]?.[0].toString()).toBe(
			"https://control.example/api/oauth/token",
		);
		const [url, request] = fetch.mock.calls[1] ?? [];
		expect(url?.toString()).toBe(
			"https://control.example/api/v1/workloads/diagnostics",
		);
		expect(request).toMatchObject({
			method: "POST",
			body: JSON.stringify(diagnostics),
		});
		expect(String(request?.body)).not.toContain(
			managedEnvironment["86D_STORE_ID"],
		);
		expect(String(request?.body)).not.toContain(
			managedEnvironment["86D_WORKLOAD_CREDENTIAL"],
		);
		expect(String(request?.body)).not.toContain("diagnostics-access-token");
		expect(new Headers(request?.headers).get("Authorization")).toBe(
			"Bearer diagnostics-access-token",
		);
		expect(new Headers(request?.headers).get("Content-Type")).toBe(
			"application/json",
		);
	});

	it("rejects commerce, shopper, Store-selector, and secret fields before network", async () => {
		const fetch = vi.fn<typeof globalThis.fetch>();
		const client = createManagedRuntimeDiagnosticsClient({
			environment: managedEnvironment,
			fetch,
		});
		const canary = "credential-token-canary-must-not-escape";
		const forbiddenPayloads = [
			{ ...diagnostics, storeId: managedEnvironment["86D_STORE_ID"] },
			{ ...diagnostics, customer: { email: "shopper@example.com" } },
			{ ...diagnostics, order: { id: "order-1", lineItems: [] } },
			{ ...diagnostics, payment: { amount: 100, currency: "USD" } },
			{ ...diagnostics, gmv: 100 },
			{ ...diagnostics, providerSecret: canary },
			{ ...diagnostics, token: canary },
			{
				...diagnostics,
				observedAt: `2026-08-12T12:00:00.${"1".repeat(1000)}Z`,
			},
			{
				...diagnostics,
				checks: [{ component: "runtime", status: "error", message: canary }],
			},
			{
				...diagnostics,
				errors: [{ category: "internal", occurrences: 1, secret: canary }],
			},
		];

		for (const payload of forbiddenPayloads) {
			let failure: unknown;
			try {
				await client.report(payload as ManagedRuntimeDiagnostics);
			} catch (error) {
				failure = error;
			}
			expect(String(failure)).toBe(
				"Error: Managed Runtime diagnostics payload is invalid",
			);
			expect(String(failure)).not.toContain(canary);
		}
		expect(fetch).not.toHaveBeenCalled();
	});

	it("bounds every versioned health and error fact", () => {
		expect(
			managedRuntimeDiagnosticsSchema.safeParse({
				...diagnostics,
				runtimeVersion: "0.0.4-release.1",
				health: "degraded",
				checks: [{ component: "storage", status: "degraded" }],
				errors: [{ category: "dependency", occurrences: 10_000 }],
			}).success,
		).toBe(true);

		const invalidPayloads = [
			{ ...diagnostics, schemaVersion: 2 },
			{ ...diagnostics, reportId: "caller-controlled-free-text" },
			{ ...diagnostics, observedAt: "yesterday" },
			{ ...diagnostics, health: "unknown" },
			{ ...diagnostics, runtimeVersion: "latest with arbitrary context" },
			{
				...diagnostics,
				checks: Array.from({ length: 17 }, () => ({
					component: "runtime",
					status: "ok",
				})),
			},
			{
				...diagnostics,
				checks: [
					{ component: "runtime", status: "ok" },
					{ component: "runtime", status: "error" },
				],
			},
			{
				...diagnostics,
				errors: Array.from({ length: 17 }, () => ({
					category: "internal",
					occurrences: 1,
				})),
			},
			{
				...diagnostics,
				errors: [{ category: "internal", occurrences: 0 }],
			},
			{
				...diagnostics,
				errors: [{ category: "internal", occurrences: 10_001 }],
			},
		];
		for (const payload of invalidPayloads) {
			expect(managedRuntimeDiagnosticsSchema.safeParse(payload).success).toBe(
				false,
			);
		}
	});

	it("returns one fixed failure for rejected or secret-bearing responses", async () => {
		const canary = "response-token-secret-canary";
		for (const response of [
			Response.json({ status: "accepted", token: canary }),
			Response.json({ status: "rejected", detail: canary }),
			new Response(canary, { status: 500 }),
		]) {
			const fetch = vi
				.fn<typeof globalThis.fetch>()
				.mockResolvedValueOnce(
					Response.json({
						access_token: "diagnostics-access-token",
						token_type: "Bearer",
						expires_in: 300,
						scope: "runtime.telemetry:write",
					}),
				)
				.mockResolvedValueOnce(response);
			const client = createManagedRuntimeDiagnosticsClient({
				environment: managedEnvironment,
				fetch,
			});

			let failure: unknown;
			try {
				await client.report(diagnostics);
			} catch (error) {
				failure = error;
			}
			expect(String(failure)).toBe(
				"Error: Managed Runtime diagnostics request failed",
			);
			expect(String(failure)).not.toContain(canary);
			expect(String(failure)).not.toContain(
				managedEnvironment["86D_WORKLOAD_CREDENTIAL"],
			);
		}
	});

	it("redacts workload-client and transport failures", async () => {
		const canary = "network-credential-token-canary";
		const fetch = vi
			.fn<typeof globalThis.fetch>()
			.mockRejectedValue(new Error(canary));
		const client = createManagedRuntimeDiagnosticsClient({
			environment: managedEnvironment,
			fetch,
		});

		let failure: unknown;
		try {
			await client.report(diagnostics);
		} catch (error) {
			failure = error;
		}
		expect(String(failure)).toBe(
			"Error: Managed Runtime diagnostics request failed",
		);
		expect(String(failure)).not.toContain(canary);
		expect(String(failure)).not.toContain(
			managedEnvironment["86D_WORKLOAD_CREDENTIAL"],
		);
	});
});
