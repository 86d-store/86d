import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	readConfig: vi.fn(),
	prove: vi.fn(),
	createBridge: vi.fn(),
	rateLimitCheck: vi.fn().mockReturnValue({ allowed: true, resetAt: 0 }),
}));

mocks.createBridge.mockImplementation(() => ({ prove: mocks.prove }));

vi.mock("@86d-app/sdk/workload-token-client", () => ({
	readManagedWorkloadConfig: mocks.readConfig,
}));

vi.mock("@86d-app/sdk/workload-identity-proof", () => ({
	createWorkloadIdentityProofBridge: mocks.createBridge,
}));

vi.mock("utils/rate-limit", () => ({
	createRateLimiter: () => ({ check: mocks.rateLimitCheck }),
}));

const { POST } = await import("../route");

const challenge = "h".repeat(43);
const managedConfig = {
	storeId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
	apiBaseUrl: "https://api.86d.app",
	credential: `86d_wc_${"c".repeat(24)}.${"s".repeat(43)}`,
};

function request(body: string, ip = "127.0.0.1") {
	return new NextRequest(
		"https://store.example/api/86d/workload-identity/prove",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-forwarded-for": ip,
			},
			body,
		},
	);
}

describe("POST /api/86d/workload-identity/prove", () => {
	beforeEach(() => {
		mocks.readConfig.mockReset();
		mocks.prove.mockReset();
		mocks.rateLimitCheck.mockReturnValue({ allowed: true, resetAt: 0 });
	});

	it("reuses one proof bridge while returning only safe success status", async () => {
		mocks.readConfig.mockReturnValue(managedConfig);
		mocks.prove.mockResolvedValue({ status: "ok" });

		const first = await POST(request(JSON.stringify({ challenge }), "cache-1"));
		const second = await POST(
			request(JSON.stringify({ challenge }), "cache-2"),
		);

		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		expect(await first.json()).toEqual({ status: "ok" });
		expect(await second.json()).toEqual({ status: "ok" });
		expect(mocks.createBridge).toHaveBeenCalledTimes(1);
		expect(mocks.createBridge).toHaveBeenCalledWith({ config: managedConfig });
		expect(mocks.prove).toHaveBeenCalledTimes(2);
		expect(mocks.prove).toHaveBeenCalledWith({ challenge });
	});

	it("returns unavailable with zero proof network when standalone", async () => {
		mocks.readConfig.mockReturnValue(undefined);

		const response = await POST(request(JSON.stringify({ challenge })));

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ status: "unavailable" });
		expect(mocks.prove).not.toHaveBeenCalled();
	});

	it("rejects invalid requests before reading managed secrets", async () => {
		for (const body of [
			"not-json",
			JSON.stringify({}),
			JSON.stringify({ challenge: "short" }),
			JSON.stringify({ challenge, extra: "not-allowed" }),
		]) {
			const response = await POST(request(body));
			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ status: "invalid_request" });
		}
		expect(mocks.readConfig).not.toHaveBeenCalled();
		expect(mocks.prove).not.toHaveBeenCalled();
	});

	it("returns one fixed safe failure without echoing secret material", async () => {
		const canary = "credential-token-challenge-canary";
		mocks.readConfig.mockReturnValue(managedConfig);
		mocks.prove.mockRejectedValue(new Error(canary));

		const response = await POST(request(JSON.stringify({ challenge })));
		const serialized = JSON.stringify(await response.json());

		expect(response.status).toBe(502);
		expect(serialized).toBe('{"status":"failed"}');
		expect(serialized).not.toContain(canary);
		expect(serialized).not.toContain(managedConfig.credential);
		expect(serialized).not.toContain(challenge);
	});

	it("rate limits proof triggers before reading configuration", async () => {
		mocks.rateLimitCheck.mockReturnValue({
			allowed: false,
			resetAt: Date.now() + 60_000,
		});

		const response = await POST(request(JSON.stringify({ challenge })));

		expect(response.status).toBe(429);
		expect(await response.json()).toEqual({ status: "rate_limited" });
		expect(mocks.readConfig).not.toHaveBeenCalled();
		expect(mocks.prove).not.toHaveBeenCalled();
	});
});
