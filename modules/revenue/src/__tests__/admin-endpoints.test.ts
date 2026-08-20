import { describe, expect, it, vi } from "vitest";
import { exportTransactions } from "../admin/endpoints/export-transactions";
import { getStats } from "../admin/endpoints/get-stats";
import { listTransactions } from "../admin/endpoints/list-transactions";
import type { RevenueIntent } from "../service";
import { listCustomerTransactions } from "../store/endpoints/list-transactions";

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeIntent(overrides: Partial<RevenueIntent> = {}): RevenueIntent {
	return {
		id: crypto.randomUUID(),
		amount: 1000,
		currency: "USD",
		status: "succeeded",
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

function makeCapabilities(intents: RevenueIntent[]) {
	return {
		invoke: vi.fn().mockResolvedValue({
			ok: true,
			decision: { operation: "list", intents },
		}),
	};
}

function unavailableCapabilities() {
	return {
		invoke: vi.fn().mockResolvedValue({
			ok: false,
			failure: {
				code: "CAPABILITY_UNAVAILABLE",
				capability: "payments.intent",
				version: "1.0.0",
			},
		}),
	};
}

function callAdmin(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	query: Record<string, string | undefined>,
	capabilities?: { invoke: ReturnType<typeof vi.fn> },
) {
	return handler({
		query,
		context: { capabilities: capabilities ?? unavailableCapabilities() },
	});
}

function callStore(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	query: Record<string, string | undefined>,
	session: { user: { id: string } } | null,
	capabilities?: { invoke: ReturnType<typeof vi.fn> },
) {
	return handler({
		query,
		context: {
			session,
			capabilities: capabilities ?? unavailableCapabilities(),
		},
	});
}

const getStatsHandler = extractHandler(getStats);
const listHandler = extractHandler(listTransactions);
const exportHandler = extractHandler(exportTransactions);
const storeHandler = extractHandler(listCustomerTransactions);

// ── getStats ─────────────────────────────────────────────────────────────────

describe("admin /revenue/stats", () => {
	it("fails closed when authoritative Payments is unavailable", async () => {
		const result = (await callAdmin(getStatsHandler, {}, undefined)) as {
			code: string;
			status: number;
		};
		expect(result).toMatchObject({
			code: "REVENUE_SOURCE_UNAVAILABLE",
			status: 503,
		});
	});

	it("aggregates succeeded intents into totalVolume", async () => {
		const capabilities = makeCapabilities([
			makeIntent({ status: "succeeded", amount: 2000 }),
			makeIntent({ status: "succeeded", amount: 3000 }),
			makeIntent({ status: "failed", amount: 9999 }),
		]);
		const result = (await callAdmin(getStatsHandler, {}, capabilities)) as {
			totalVolume: number;
			transactionCount: number;
		};
		expect(result.totalVolume).toBe(5000);
		expect(result.transactionCount).toBe(2);
	});

	it("respects the from/to date range filter", async () => {
		const old = makeIntent({
			status: "succeeded",
			amount: 9999,
			createdAt: new Date("2020-01-01"),
		});
		const recent = makeIntent({
			status: "succeeded",
			amount: 500,
			createdAt: new Date(),
		});
		const capabilities = makeCapabilities([old, recent]);
		const result = (await callAdmin(
			getStatsHandler,
			{ from: new Date(Date.now() - 86400000).toISOString() },
			capabilities,
		)) as { totalVolume: number };
		expect(result.totalVolume).toBe(500);
	});

	it("requests at most 10 000 intents through the capability", async () => {
		const capabilities = makeCapabilities([]);
		await callAdmin(getStatsHandler, {}, capabilities);
		expect(capabilities.invoke).toHaveBeenCalledWith(
			expect.objectContaining({ name: "payments.intent" }),
			{ operation: "list", take: 10000 },
		);
	});
});

// ── listTransactions ──────────────────────────────────────────────────────────

describe("admin /revenue/transactions", () => {
	it("fails closed when authoritative Payments is unavailable", async () => {
		const result = (await callAdmin(listHandler, {}, undefined)) as {
			code: string;
			status: number;
		};
		expect(result).toMatchObject({
			code: "REVENUE_SOURCE_UNAVAILABLE",
			status: 503,
		});
	});

	it("returns paginated transactions sorted newest-first", async () => {
		const older = makeIntent({ createdAt: new Date("2024-01-01") });
		const newer = makeIntent({ createdAt: new Date("2024-06-01") });
		const capabilities = makeCapabilities([older, newer]);
		const result = (await callAdmin(
			listHandler,
			{ page: "1", limit: "2" },
			capabilities,
		)) as { transactions: Array<{ id: string }> };
		expect(result.transactions[0].id).toBe(newer.id);
	});

	it("filters by status", async () => {
		const succeeded = makeIntent({ status: "succeeded" });
		const failed = makeIntent({ status: "failed" });
		const capabilities = makeCapabilities([succeeded, failed]);
		const result = (await callAdmin(
			listHandler,
			{ status: "failed" },
			capabilities,
		)) as { transactions: Array<{ status: string }>; total: number };
		expect(result.total).toBe(1);
		expect(result.transactions[0].status).toBe("failed");
	});

	it("searches by email substring", async () => {
		const match = makeIntent({ email: "alice@example.com" });
		const noMatch = makeIntent({ email: "bob@example.com" });
		const capabilities = makeCapabilities([match, noMatch]);
		const result = (await callAdmin(
			listHandler,
			{ search: "alice" },
			capabilities,
		)) as { total: number };
		expect(result.total).toBe(1);
	});

	it("returns correct total across pages", async () => {
		const intents = Array.from({ length: 25 }, () => makeIntent());
		const capabilities = makeCapabilities(intents);
		const page1 = (await callAdmin(
			listHandler,
			{ page: "1", limit: "10" },
			capabilities,
		)) as { total: number; transactions: unknown[] };
		expect(page1.total).toBe(25);
		expect(page1.transactions).toHaveLength(10);
	});
});

// ── exportTransactions ────────────────────────────────────────────────────────

describe("admin /revenue/export", () => {
	it("returns a CSV string with a header row", async () => {
		const capabilities = makeCapabilities([
			makeIntent({ amount: 4999, currency: "USD" }),
		]);
		const result = (await callAdmin(exportHandler, {}, capabilities)) as {
			csv: string;
			count: number;
		};
		expect(result.csv).toContain("Date,Transaction ID,Status,Amount");
		expect(result.count).toBe(1);
	});

	it("returns empty CSV with header when no intents exist", async () => {
		const capabilities = makeCapabilities([]);
		const result = (await callAdmin(exportHandler, {}, capabilities)) as {
			csv: string;
			count: number;
		};
		expect(result.csv).toContain("Date,Transaction ID");
		expect(result.count).toBe(0);
	});

	it("fails closed when authoritative Payments is unavailable", async () => {
		const result = (await callAdmin(exportHandler, {}, undefined)) as {
			code: string;
			status: number;
		};
		expect(result).toMatchObject({
			code: "REVENUE_SOURCE_UNAVAILABLE",
			status: 503,
		});
	});
});

// ── store /revenue/transactions ───────────────────────────────────────────────

describe("store /revenue/transactions", () => {
	it("returns 401 when no session", async () => {
		const result = (await callStore(storeHandler, {}, null)) as {
			status: number;
		};
		expect(result.status).toBe(401);
	});

	it("fails closed when authoritative Payments is unavailable", async () => {
		const result = (await callStore(
			storeHandler,
			{},
			{ user: { id: "cust_1" } },
			undefined,
		)) as { code: string; status: number };
		expect(result).toMatchObject({
			code: "REVENUE_SOURCE_UNAVAILABLE",
			status: 503,
		});
	});

	it("passes customerId to the capability so customers only see their own data", async () => {
		const capabilities = makeCapabilities([
			makeIntent({ customerId: "cust_1", amount: 1000 }),
		]);
		await callStore(storeHandler, {}, { user: { id: "cust_1" } }, capabilities);
		expect(capabilities.invoke).toHaveBeenCalledWith(
			expect.objectContaining({ name: "payments.intent" }),
			expect.objectContaining({
				operation: "list",
				customerId: "cust_1",
			}),
		);
	});

	it("paginates results with a default page size of 10", async () => {
		const intents = Array.from({ length: 15 }, () =>
			makeIntent({ customerId: "cust_1" }),
		);
		const capabilities = makeCapabilities(intents);
		const result = (await callStore(
			storeHandler,
			{},
			{ user: { id: "cust_1" } },
			capabilities,
		)) as { transactions: unknown[]; total: number };
		expect(result.transactions).toHaveLength(10);
		expect(result.total).toBe(15);
	});

	it("filters by status", async () => {
		const intents = [
			makeIntent({ customerId: "cust_1", status: "succeeded" }),
			makeIntent({ customerId: "cust_1", status: "failed" }),
		];
		const capabilities = makeCapabilities(intents);
		const result = (await callStore(
			storeHandler,
			{ status: "succeeded" },
			{ user: { id: "cust_1" } },
			capabilities,
		)) as { total: number };
		expect(result.total).toBe(1);
	});
});
