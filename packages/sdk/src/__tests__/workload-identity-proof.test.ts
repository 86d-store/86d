import { describe, expect, it, vi } from "vitest";
import { createWorkloadIdentityProofBridge } from "../workload-identity-proof";
import type { ManagedWorkloadConfig } from "../workload-token-client";

const config: ManagedWorkloadConfig = {
	storeId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
	apiBaseUrl: "https://control.example",
	credential: `86d_wc_${"c".repeat(24)}.${"s".repeat(43)}`,
};
const challenge = "h".repeat(43);

describe("deployed Runtime workload identity proof", () => {
	it("uses the exact proof-only token and submits the stable challenge", async () => {
		const request = vi.fn().mockResolvedValue(Response.json({ status: "ok" }));
		const fetch = vi.fn().mockResolvedValue(Response.json({ status: "valid" }));
		const bridge = createWorkloadIdentityProofBridge({
			config,
			client: { configured: true, getToken: vi.fn(), request },
			fetch,
		});

		await expect(bridge.prove({ challenge })).resolves.toEqual({
			status: "ok",
		});
		expect(fetch).toHaveBeenCalledOnce();
		expect(fetch).toHaveBeenCalledWith(
			"https://control.example/api/v1/workloads/proof-challenges/validate",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					challenge,
					storeId: config.storeId,
					runtimeEnvironment: "production",
				}),
				cache: "no-store",
				redirect: "error",
			},
		);
		expect(request).toHaveBeenCalledOnce();
		expect(request).toHaveBeenCalledWith(
			{
				audience: "https://86d.app/api/store-runtime",
				scopes: ["runtime.health:read"],
			},
			"v1/workloads/proof",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ challenge }),
			},
		);
	});

	it("rejects malformed challenges before requesting a token", async () => {
		for (const invalid of [
			"",
			"a".repeat(42),
			"a".repeat(44),
			`${"a".repeat(42)}=`,
			`${"a".repeat(42)}.`,
			`${"a".repeat(42)}\n`,
		]) {
			const request = vi.fn();
			const bridge = createWorkloadIdentityProofBridge({
				config,
				client: { configured: true, getToken: vi.fn(), request },
				fetch: vi.fn(),
			});
			await expect(bridge.prove({ challenge: invalid })).rejects.toThrow(
				"Managed workload identity proof request is invalid",
			);
			expect(request).not.toHaveBeenCalled();
		}
	});

	it("rejects an unissued challenge after preflight without a token request", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValue(Response.json({ status: "invalid" }, { status: 404 }));
		const bridge = createWorkloadIdentityProofBridge({
			config,
			fetch,
		});

		await expect(bridge.prove({ challenge })).rejects.toThrow(
			"Managed workload identity proof failed",
		);

		expect(fetch).toHaveBeenCalledOnce();
		expect(fetch.mock.calls[0]?.[0]).toBe(
			"https://control.example/api/v1/workloads/proof-challenges/validate",
		);
	});

	it("normalizes an API-prefixed Control Plane base for preflight", async () => {
		const fetch = vi.fn().mockResolvedValue(Response.json({ status: "valid" }));
		const request = vi.fn().mockResolvedValue(Response.json({ status: "ok" }));
		const bridge = createWorkloadIdentityProofBridge({
			config: { ...config, apiBaseUrl: "https://control.example/api/" },
			client: { configured: true, getToken: vi.fn(), request },
			fetch,
		});

		await bridge.prove({ challenge });

		expect(fetch.mock.calls[0]?.[0]).toBe(
			"https://control.example/api/v1/workloads/proof-challenges/validate",
		);
	});

	it("redacts a preflight network error before any token request", async () => {
		const canary = "preflight-network-canary-must-not-escape";
		const request = vi.fn();
		const bridge = createWorkloadIdentityProofBridge({
			config,
			client: { configured: true, getToken: vi.fn(), request },
			fetch: vi.fn().mockRejectedValue(new Error(canary)),
		});

		let thrown: unknown;
		try {
			await bridge.prove({ challenge });
		} catch (error) {
			thrown = error;
		}

		expect(String(thrown)).toBe(
			"Error: Managed workload identity proof failed",
		);
		expect(String(thrown)).not.toContain(canary);
		expect(String(thrown)).not.toContain(challenge);
		expect(request).not.toHaveBeenCalled();
	});

	it("rejects non-exact and failed preflight responses without leaking them", async () => {
		const canary = "preflight-challenge-canary-must-not-escape";
		for (const response of [
			Response.json({ status: "valid", extra: canary }),
			Response.json({ status: "invalid", detail: canary }),
			new Response(canary, { status: 500 }),
		]) {
			const request = vi.fn();
			const bridge = createWorkloadIdentityProofBridge({
				config,
				client: { configured: true, getToken: vi.fn(), request },
				fetch: vi.fn().mockResolvedValue(response),
			});
			let thrown: unknown;
			try {
				await bridge.prove({ challenge });
			} catch (error) {
				thrown = error;
			}
			expect(String(thrown)).toBe(
				"Error: Managed workload identity proof failed",
			);
			expect(String(thrown)).not.toContain(canary);
			expect(String(thrown)).not.toContain(challenge);
			expect(String(thrown)).not.toContain(config.credential);
			expect(request).not.toHaveBeenCalled();
		}
	});

	it("rejects malformed or failed proof responses through one secret-free error", async () => {
		const canary = "credential-token-response-canary";
		for (const response of [
			Response.json({ status: "ok", token: canary }),
			Response.json({ status: "nope", detail: canary }),
			new Response(canary, { status: 401 }),
			new Response(canary, { status: 500 }),
		]) {
			const bridge = createWorkloadIdentityProofBridge({
				config,
				client: {
					configured: true,
					getToken: vi.fn(),
					request: vi.fn().mockResolvedValue(response),
				},
				fetch: vi.fn().mockResolvedValue(Response.json({ status: "valid" })),
			});
			let thrown: unknown;
			try {
				await bridge.prove({ challenge });
			} catch (error) {
				thrown = error;
			}
			expect(String(thrown)).toBe(
				"Error: Managed workload identity proof failed",
			);
			expect(String(thrown)).not.toContain(canary);
			expect(String(thrown)).not.toContain(config.credential);
			expect(String(thrown)).not.toContain(challenge);
		}
	});

	it("redacts a token-client failure", async () => {
		const canary = "token-client-error-canary";
		const bridge = createWorkloadIdentityProofBridge({
			config,
			client: {
				configured: true,
				getToken: vi.fn(),
				request: vi.fn().mockRejectedValue(new Error(canary)),
			},
			fetch: vi.fn().mockResolvedValue(Response.json({ status: "valid" })),
		});

		let thrown: unknown;
		try {
			await bridge.prove({ challenge });
		} catch (error) {
			thrown = error;
		}
		expect(String(thrown)).toBe(
			"Error: Managed workload identity proof failed",
		);
		expect(String(thrown)).not.toContain(canary);
	});
});
