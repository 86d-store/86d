import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	queryRaw: vi.fn(),
	healthCheck: vi.fn(),
	rateLimitCheck: vi.fn().mockReturnValue({ allowed: true, resetAt: 0 }),
}));

vi.mock("db", () => ({
	db: { $queryRaw: mocks.queryRaw },
}));

vi.mock("~/lib/storage", () => ({
	getStorage: () => ({ healthCheck: mocks.healthCheck }),
}));

vi.mock("utils/rate-limit", () => ({
	createRateLimiter: () => ({ check: mocks.rateLimitCheck }),
}));

function makeRequest(ip = "127.0.0.1") {
	return new NextRequest("http://localhost/api/health", {
		headers: { "x-forwarded-for": ip },
	});
}

const { GET } = await import("../route");

describe("GET /api/health", () => {
	beforeEach(() => {
		mocks.queryRaw.mockReset();
		mocks.healthCheck.mockReset();
		mocks.rateLimitCheck.mockReturnValue({ allowed: true, resetAt: 0 });
	});

	it("returns 200 and healthy status when DB and storage are up", async () => {
		mocks.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
		mocks.healthCheck.mockResolvedValue(true);

		const response = await GET(makeRequest());
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.status).toBe("healthy");
		expect(body.checks.app).toBe("ok");
		expect(body.checks.database).toBe("ok");
		expect(body.checks.storage).toBe("ok");
		expect(typeof body.timestamp).toBe("string");
	});

	it("returns 200 and degraded status when storage is down but DB is up", async () => {
		mocks.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
		mocks.healthCheck.mockResolvedValue(false);

		const response = await GET(makeRequest());
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.status).toBe("degraded");
		expect(body.checks.database).toBe("ok");
		expect(body.checks.storage).toBe("error");
	});

	it("returns 503 and unhealthy status when DB is down", async () => {
		mocks.queryRaw.mockRejectedValue(new Error("Connection refused"));
		mocks.healthCheck.mockResolvedValue(true);

		const response = await GET(makeRequest());
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body.status).toBe("unhealthy");
		expect(body.checks.database).toBe("error");
	});

	it("returns 503 when both DB and storage are down", async () => {
		mocks.queryRaw.mockRejectedValue(new Error("DB down"));
		mocks.healthCheck.mockRejectedValue(new Error("Storage down"));

		const response = await GET(makeRequest());
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body.status).toBe("unhealthy");
		expect(body.checks.database).toBe("error");
		expect(body.checks.storage).toBe("error");
	});

	it("returns 200 degraded when storage throws (non-critical)", async () => {
		mocks.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
		mocks.healthCheck.mockRejectedValue(new Error("Storage unavailable"));

		const response = await GET(makeRequest());
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.status).toBe("degraded");
		expect(body.checks.storage).toBe("error");
	});

	it("includes an ISO timestamp in the response", async () => {
		mocks.queryRaw.mockResolvedValue([]);
		mocks.healthCheck.mockResolvedValue(true);

		const response = await GET(makeRequest());
		const body = await response.json();

		expect(() => new Date(body.timestamp)).not.toThrow();
		expect(new Date(body.timestamp).getTime()).toBeGreaterThan(0);
	});

	it("returns 429 when rate limit is exceeded", async () => {
		mocks.rateLimitCheck.mockReturnValue({
			allowed: false,
			resetAt: Date.now() + 60000,
		});

		const response = await GET(makeRequest());

		expect(response.status).toBe(429);
	});
});
