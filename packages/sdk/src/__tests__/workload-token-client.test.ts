import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createWorkloadTokenClient,
	type ManagedWorkloadConfig,
	readManagedWorkloadConfig,
} from "../workload-token-client";

const credentialId = "86d_wc_abcdefghijklmnopqrstuvwx";
const credentialSecret = "s".repeat(43);
const managedConfig: ManagedWorkloadConfig = {
	storeId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
	apiBaseUrl: "https://control.example/api/",
	credential: `${credentialId}.${credentialSecret}`,
};
const resource = {
	audience: "https://86d.app/api/store-runtime",
	scopes: ["runtime.telemetry:write", "runtime.config:read"],
};

function tokenResponse(
	token = "ey.secret-access-token",
	overrides: Record<string, unknown> = {},
): Response {
	return Response.json({
		access_token: token,
		token_type: "Bearer",
		expires_in: 300,
		scope: "runtime.config:read runtime.telemetry:write",
		...overrides,
	});
}

describe("workload token client", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.useRealTimers();
	});

	it("exchanges the opaque credential using the OAuth client-credentials contract", async () => {
		const fetch = vi.fn().mockResolvedValue(tokenResponse());
		const client = createWorkloadTokenClient({ config: managedConfig, fetch });

		await expect(client.getToken(resource)).resolves.toBe(
			"ey.secret-access-token",
		);

		expect(fetch).toHaveBeenCalledOnce();
		const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://control.example/api/oauth/token");
		expect(init.method).toBe("POST");
		expect(init.headers).toEqual({
			Authorization: `Basic ${Buffer.from(`${credentialId}:${credentialSecret}`).toString("base64")}`,
			"Content-Type": "application/x-www-form-urlencoded",
		});
		expect(init.body).toBe(
			"grant_type=client_credentials&resource=https%3A%2F%2F86d.app%2Fapi%2Fstore-runtime&scope=runtime.config%3Aread+runtime.telemetry%3Awrite",
		);
	});

	it.each([
		["https://control.example", "https://control.example/api"],
		["https://control.example/api/", "https://control.example/api"],
	])(
		"normalizes Control Plane base %s without duplicating the API prefix",
		async (apiBaseUrl, expectedApiRoot) => {
			const fetch = vi
				.fn()
				.mockResolvedValueOnce(tokenResponse())
				.mockResolvedValueOnce(Response.json({ status: "ok" }));
			const client = createWorkloadTokenClient({
				config: { ...managedConfig, apiBaseUrl },
				fetch,
			});

			await client.request(resource, "v1/workloads/proof", { method: "POST" });

			expect(fetch.mock.calls[0]?.[0].toString()).toBe(
				`${expectedApiRoot}/oauth/token`,
			);
			expect(fetch.mock.calls[1]?.[0].toString()).toBe(
				`${expectedApiRoot}/v1/workloads/proof`,
			);
		},
	);

	it("caches tokens by audience and canonical scope set", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(tokenResponse("token-for-config"))
			.mockResolvedValueOnce(
				tokenResponse("token-for-ai", {
					scope: "ai:invoke",
				}),
			);
		const client = createWorkloadTokenClient({ config: managedConfig, fetch });

		await expect(client.getToken(resource)).resolves.toBe("token-for-config");
		await expect(
			client.getToken({
				...resource,
				scopes: [
					"runtime.config:read",
					"runtime.telemetry:write",
					"runtime.config:read",
				],
			}),
		).resolves.toBe("token-for-config");
		await expect(
			client.getToken({
				audience: "https://86d.app/api/ai-gateway",
				scopes: ["ai:invoke"],
			}),
		).resolves.toBe("token-for-ai");

		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("refreshes a cached token before it expires", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-11T12:00:00.000Z"));
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(tokenResponse("first-token"))
			.mockResolvedValueOnce(tokenResponse("refreshed-token"));
		const client = createWorkloadTokenClient({ config: managedConfig, fetch });

		await expect(client.getToken(resource)).resolves.toBe("first-token");
		vi.setSystemTime(new Date("2026-08-11T12:04:29.000Z"));
		await expect(client.getToken(resource)).resolves.toBe("first-token");
		vi.setSystemTime(new Date("2026-08-11T12:04:30.000Z"));
		await expect(client.getToken(resource)).resolves.toBe("refreshed-token");

		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("coalesces concurrent exchanges for the same resource", async () => {
		let resolveExchange: ((response: Response) => void) | undefined;
		const exchange = new Promise<Response>((resolve) => {
			resolveExchange = resolve;
		});
		const fetch = vi.fn().mockReturnValue(exchange);
		const client = createWorkloadTokenClient({ config: managedConfig, fetch });

		const first = client.getToken(resource);
		const second = client.getToken({
			...resource,
			scopes: [...resource.scopes].reverse(),
		});
		expect(fetch).toHaveBeenCalledOnce();
		resolveExchange?.(tokenResponse("shared-token"));

		await expect(Promise.all([first, second])).resolves.toEqual([
			"shared-token",
			"shared-token",
		]);
		expect(fetch).toHaveBeenCalledOnce();
	});

	it("makes no network call when managed workload configuration is absent", async () => {
		const fetch = vi.fn();
		const client = createWorkloadTokenClient({ config: undefined, fetch });

		expect(client.configured).toBe(false);
		await expect(client.getToken(resource)).rejects.toThrow(
			"Managed workload identity is not configured",
		);
		await expect(
			client.request(resource, "https://control.example/api/health"),
		).rejects.toThrow("Managed workload identity is not configured");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("reads only the complete managed workload environment triplet", () => {
		expect(readManagedWorkloadConfig({})).toBeUndefined();
		expect(
			readManagedWorkloadConfig({
				STORE_ID: managedConfig.storeId,
				"86D_API_URL": managedConfig.apiBaseUrl,
			}),
		).toBeUndefined();
		expect(
			readManagedWorkloadConfig({
				"86D_STORE_ID": managedConfig.storeId,
				"86D_API_URL": managedConfig.apiBaseUrl,
				"86D_WORKLOAD_CREDENTIAL": managedConfig.credential,
			}),
		).toEqual(managedConfig);
	});

	it("rejects partial or malformed managed configuration without disclosing values", () => {
		const secretCanary = "credential-canary-must-not-escape";
		const invalidEnvironments = [
			{ "86D_STORE_ID": managedConfig.storeId },
			{
				"86D_STORE_ID": "not-a-store-id",
				"86D_API_URL": managedConfig.apiBaseUrl,
				"86D_WORKLOAD_CREDENTIAL": `${credentialId}.${secretCanary}`,
			},
			{
				"86D_STORE_ID": managedConfig.storeId,
				"86D_API_URL": "javascript:credential-canary-must-not-escape",
				"86D_WORKLOAD_CREDENTIAL": `${credentialId}.${secretCanary}`,
			},
			{
				"86D_STORE_ID": managedConfig.storeId,
				"86D_API_URL": managedConfig.apiBaseUrl,
				"86D_WORKLOAD_CREDENTIAL": secretCanary,
			},
		];

		for (const environment of invalidEnvironments) {
			let thrown: unknown;
			try {
				readManagedWorkloadConfig(environment);
			} catch (error) {
				thrown = error;
			}
			expect(thrown).toBeInstanceOf(Error);
			expect(String(thrown)).not.toContain(secretCanary);
		}
	});

	it("refreshes and retries once after an invalid-token Bearer challenge", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(tokenResponse("stale-token"))
			.mockResolvedValueOnce(
				new Response(null, {
					status: 401,
					headers: {
						"WWW-Authenticate": 'Bearer error="invalid_token"',
					},
				}),
			)
			.mockResolvedValueOnce(tokenResponse("fresh-token"))
			.mockResolvedValueOnce(Response.json({ status: "ok" }));
		const client = createWorkloadTokenClient({ config: managedConfig, fetch });

		const response = await client.request(
			resource,
			"https://control.example/api/v1/runtime/health",
		);

		expect(response.status).toBe(200);
		expect(fetch).toHaveBeenCalledTimes(4);
		expect(
			new Headers(
				(fetch.mock.calls[1]?.[1] as RequestInit | undefined)?.headers,
			).get("Authorization"),
		).toBe("Bearer stale-token");
		expect(
			new Headers(
				(fetch.mock.calls[3]?.[1] as RequestInit | undefined)?.headers,
			).get("Authorization"),
		).toBe("Bearer fresh-token");
	});

	it("replays a body-bearing Request with a fresh body on invalid-token retry", async () => {
		let exchangeCount = 0;
		const bodies: string[] = [];
		const authorizations: Array<string | null> = [];
		const fetch = vi.fn(
			async (input: string | URL | Request, init?: RequestInit) => {
				if (!(input instanceof Request)) {
					exchangeCount += 1;
					return tokenResponse(
						exchangeCount === 1 ? "stale-post-token" : "fresh-post-token",
					);
				}
				bodies.push(await input.text());
				authorizations.push(new Headers(init?.headers).get("Authorization"));
				return bodies.length === 1
					? new Response(null, {
							status: 401,
							headers: {
								"WWW-Authenticate": 'Bearer error="invalid_token"',
							},
						})
					: Response.json({ status: "ok" });
			},
		);
		const client = createWorkloadTokenClient({ config: managedConfig, fetch });
		const request = new Request(
			"https://control.example/api/v1/runtime/events",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ kind: "health" }),
			},
		);

		await expect(client.request(resource, request)).resolves.toHaveProperty(
			"status",
			200,
		);

		expect(bodies).toEqual([
			JSON.stringify({ kind: "health" }),
			JSON.stringify({ kind: "health" }),
		]);
		expect(authorizations).toEqual([
			"Bearer stale-post-token",
			"Bearer fresh-post-token",
		]);
		expect(request.bodyUsed).toBe(false);
		expect(fetch).toHaveBeenCalledTimes(4);
	});

	it("rejects invalid exchange responses without disclosing credentials or tokens", async () => {
		const secretCanary = "response-canary-must-not-escape";
		const invalidResponses = [
			tokenResponse(secretCanary, { token_type: "Basic" }),
			tokenResponse(`invalid token\n${secretCanary}`),
			tokenResponse(secretCanary, { scope: "runtime.config:read" }),
			tokenResponse(secretCanary, { refresh_token: secretCanary }),
			tokenResponse(secretCanary, { expires_in: 0 }),
			new Response(secretCanary, { status: 401 }),
		];

		for (const response of invalidResponses) {
			const client = createWorkloadTokenClient({
				config: managedConfig,
				fetch: vi.fn().mockResolvedValue(response),
			});
			let thrown: unknown;
			try {
				await client.getToken(resource);
			} catch (error) {
				thrown = error;
			}
			expect(thrown).toBeInstanceOf(Error);
			expect(String(thrown)).toBe(
				"Error: Managed workload token exchange failed",
			);
			expect(String(thrown)).not.toContain(secretCanary);
			expect(String(thrown)).not.toContain(managedConfig.credential);
		}
	});

	it("redacts failures from both token exchange and protected requests", async () => {
		const secretCanary = "network-error-canary-must-not-escape";
		const exchangeClient = createWorkloadTokenClient({
			config: managedConfig,
			fetch: vi.fn().mockRejectedValue(new Error(secretCanary)),
		});
		await expect(exchangeClient.getToken(resource)).rejects.toThrow(
			"Managed workload token exchange failed",
		);

		const requestClient = createWorkloadTokenClient({
			config: managedConfig,
			fetch: vi
				.fn()
				.mockResolvedValueOnce(tokenResponse())
				.mockRejectedValueOnce(new Error(secretCanary)),
		});
		let thrown: unknown;
		try {
			await requestClient.request(
				resource,
				"https://control.example/api/health",
			);
		} catch (error) {
			thrown = error;
		}
		expect(String(thrown)).toBe("Error: Managed workload request failed");
		expect(String(thrown)).not.toContain(secretCanary);
		expect(String(thrown)).not.toContain(managedConfig.credential);
	});

	it("does not refresh for an invalid challenge and never retries more than once", async () => {
		for (const response of [
			new Response(null, { status: 401 }),
			new Response(null, {
				status: 401,
				headers: {
					"WWW-Authenticate": 'Bearer error="insufficient_scope"',
				},
			}),
			new Response(null, {
				status: 403,
				headers: {
					"WWW-Authenticate": 'Bearer error="invalid_token"',
				},
			}),
		]) {
			const fetch = vi
				.fn()
				.mockResolvedValueOnce(tokenResponse())
				.mockResolvedValueOnce(response);
			const client = createWorkloadTokenClient({
				config: managedConfig,
				fetch,
			});
			await expect(
				client.request(resource, "https://control.example/api/health"),
			).resolves.toBe(response);
			expect(fetch).toHaveBeenCalledTimes(2);
		}

		const fetch = vi
			.fn()
			.mockResolvedValueOnce(tokenResponse("first-token"))
			.mockResolvedValueOnce(
				new Response(null, {
					status: 401,
					headers: {
						"WWW-Authenticate": 'Bearer error="invalid_token"',
					},
				}),
			)
			.mockResolvedValueOnce(tokenResponse("second-token"))
			.mockResolvedValueOnce(
				new Response(null, {
					status: 401,
					headers: {
						"WWW-Authenticate": 'Bearer error="invalid_token"',
					},
				}),
			);
		const client = createWorkloadTokenClient({ config: managedConfig, fetch });
		const response = await client.request(
			resource,
			"https://control.example/api/health",
		);
		expect(response.status).toBe(401);
		expect(fetch).toHaveBeenCalledTimes(4);
	});

	it("rejects malformed audiences and scopes before making a network call", async () => {
		const invalidResources = [
			{ audience: "", scopes: ["runtime.config:read"] },
			{ audience: "javascript:alert(1)", scopes: ["runtime.config:read"] },
			{ audience: resource.audience, scopes: [] },
			{ audience: resource.audience, scopes: ["runtime config read"] },
			{ audience: resource.audience, scopes: ["runtime.config:read\nleak"] },
		];

		for (const invalidResource of invalidResources) {
			const fetch = vi.fn();
			const client = createWorkloadTokenClient({
				config: managedConfig,
				fetch,
			});
			await expect(client.getToken(invalidResource)).rejects.toThrow(
				"Managed workload token resource is invalid",
			);
			expect(fetch).not.toHaveBeenCalled();
		}
	});

	it("never sends an access token outside the configured Control Plane API", async () => {
		const fetch = vi.fn();
		const client = createWorkloadTokenClient({ config: managedConfig, fetch });

		await expect(
			client.request(resource, "https://attacker.example/collect"),
		).rejects.toThrow("Managed workload request target is invalid");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("does not evict a newer token when an older request receives a late challenge", async () => {
		let exchangeCount = 0;
		let protectedCount = 0;
		let resolveLateChallenge: ((response: Response) => void) | undefined;
		const lateChallenge = new Promise<Response>((resolve) => {
			resolveLateChallenge = resolve;
		});
		const invalidToken = () =>
			new Response(null, {
				status: 401,
				headers: { "WWW-Authenticate": 'Bearer error="invalid_token"' },
			});
		const fetch = vi.fn(async (input: string | URL | Request) => {
			if (input.toString().endsWith("/oauth/token")) {
				exchangeCount += 1;
				return tokenResponse(`token-${exchangeCount}`);
			}
			protectedCount += 1;
			if (protectedCount === 1) {
				return invalidToken();
			}
			if (protectedCount === 2) {
				return lateChallenge;
			}
			return Response.json({ status: "ok" });
		});
		const client = createWorkloadTokenClient({ config: managedConfig, fetch });
		await client.getToken(resource);

		const first = client.request(resource, "v1/runtime/health");
		const late = client.request(resource, "v1/runtime/health");
		await expect(first).resolves.toHaveProperty("status", 200);
		resolveLateChallenge?.(invalidToken());
		await expect(late).resolves.toHaveProperty("status", 200);

		expect(exchangeCount).toBe(2);
		expect(protectedCount).toBe(4);
	});
});
