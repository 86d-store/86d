import { describe, expect, it } from "vitest";
import type { RevenueIntent } from "../service";
import {
	aggregateStats,
	buildCSV,
	escapeCSV,
	filterAndPageTransactions,
} from "../service-impl";

function makeIntent(overrides: Partial<RevenueIntent> = {}): RevenueIntent {
	return {
		id: crypto.randomUUID(),
		amount: 1000,
		currency: "USD",
		status: "pending",
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

describe("aggregateStats", () => {
	it("returns zero stats for empty input", () => {
		const stats = aggregateStats([], null, null);
		expect(stats.totalVolume).toBe(0);
		expect(stats.transactionCount).toBe(0);
		expect(stats.averageValue).toBe(0);
		expect(stats.refundCount).toBe(0);
		expect(stats.refundVolume).toBe(0);
	});

	it("sums only succeeded intents for total volume", () => {
		const intents: RevenueIntent[] = [
			makeIntent({ status: "succeeded", amount: 5000 }),
			makeIntent({ status: "succeeded", amount: 3000 }),
			makeIntent({ status: "pending", amount: 2000 }),
			makeIntent({ status: "failed", amount: 1000 }),
		];
		const stats = aggregateStats(intents, null, null);
		expect(stats.totalVolume).toBe(8000);
		expect(stats.transactionCount).toBe(2);
	});

	it("calculates correct average order value", () => {
		const intents: RevenueIntent[] = [
			makeIntent({ status: "succeeded", amount: 1000 }),
			makeIntent({ status: "succeeded", amount: 3000 }),
		];
		const stats = aggregateStats(intents, null, null);
		expect(stats.averageValue).toBe(2000);
	});

	it("counts refunded intents separately", () => {
		const intents: RevenueIntent[] = [
			makeIntent({ status: "refunded", amount: 5000 }),
			makeIntent({ status: "refunded", amount: 2500 }),
		];
		const stats = aggregateStats(intents, null, null);
		expect(stats.refundVolume).toBe(7500);
		expect(stats.refundCount).toBe(2);
		expect(stats.totalVolume).toBe(0);
	});

	it("counts all statuses in byStatus", () => {
		const intents: RevenueIntent[] = [
			makeIntent({ status: "succeeded" }),
			makeIntent({ status: "pending" }),
			makeIntent({ status: "failed" }),
			makeIntent({ status: "cancelled" }),
			makeIntent({ status: "refunded" }),
			makeIntent({ status: "processing" }),
		];
		const stats = aggregateStats(intents, null, null);
		expect(stats.byStatus.succeeded).toBe(1);
		expect(stats.byStatus.pending).toBe(1);
		expect(stats.byStatus.failed).toBe(1);
		expect(stats.byStatus.cancelled).toBe(1);
		expect(stats.byStatus.refunded).toBe(1);
		expect(stats.byStatus.processing).toBe(1);
	});

	it("filters intents by from date", () => {
		const old = makeIntent({
			status: "succeeded",
			amount: 1000,
			createdAt: new Date("2024-01-01"),
		});
		const recent = makeIntent({
			status: "succeeded",
			amount: 2000,
			createdAt: new Date("2025-01-01"),
		});
		const from = new Date("2024-06-01");
		const stats = aggregateStats([old, recent], from, null);
		expect(stats.totalVolume).toBe(2000);
	});

	it("filters intents by to date", () => {
		const early = makeIntent({
			status: "succeeded",
			amount: 1000,
			createdAt: new Date("2024-01-01"),
		});
		const late = makeIntent({
			status: "succeeded",
			amount: 9000,
			createdAt: new Date("2026-01-01"),
		});
		const to = new Date("2025-01-01");
		const stats = aggregateStats([early, late], null, to);
		expect(stats.totalVolume).toBe(1000);
	});

	it("uses currency from succeeded intents", () => {
		const intents: RevenueIntent[] = [
			makeIntent({ status: "succeeded", amount: 1000, currency: "EUR" }),
		];
		const stats = aggregateStats(intents, null, null);
		expect(stats.currency).toBe("EUR");
	});
});

describe("filterAndPageTransactions", () => {
	it("returns all transactions when no filters", () => {
		const intents = Array.from({ length: 5 }, (_, k) =>
			makeIntent({ amount: 1000 + k }),
		);
		const result = filterAndPageTransactions(intents, {
			from: null,
			to: null,
			page: 1,
			limit: 20,
		});
		expect(result.total).toBe(5);
		expect(result.transactions).toHaveLength(5);
	});

	it("paginates correctly", () => {
		const intents = Array.from({ length: 10 }, (_, k) =>
			makeIntent({ amount: 1000 + k }),
		);
		const page1 = filterAndPageTransactions(intents, {
			from: null,
			to: null,
			page: 1,
			limit: 3,
		});
		const page2 = filterAndPageTransactions(intents, {
			from: null,
			to: null,
			page: 2,
			limit: 3,
		});
		expect(page1.transactions).toHaveLength(3);
		expect(page2.transactions).toHaveLength(3);
		expect(page1.total).toBe(10);

		const page1Ids = page1.transactions.map((t) => t.id);
		const page2Ids = page2.transactions.map((t) => t.id);
		expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
	});

	it("filters by status", () => {
		const intents: RevenueIntent[] = [
			makeIntent({ status: "succeeded" }),
			makeIntent({ status: "pending" }),
			makeIntent({ status: "succeeded" }),
		];
		const result = filterAndPageTransactions(intents, {
			from: null,
			to: null,
			status: "succeeded",
			page: 1,
			limit: 20,
		});
		expect(result.total).toBe(2);
		expect(result.transactions.every((t) => t.status === "succeeded")).toBe(
			true,
		);
	});

	it("filters by email search", () => {
		const intents: RevenueIntent[] = [
			makeIntent({ email: "alice@example.com" }),
			makeIntent({ email: "bob@example.com" }),
		];
		const result = filterAndPageTransactions(intents, {
			from: null,
			to: null,
			search: "alice",
			page: 1,
			limit: 20,
		});
		expect(result.total).toBe(1);
		expect(result.transactions[0].email).toBe("alice@example.com");
	});

	it("filters by order ID search", () => {
		const intents: RevenueIntent[] = [
			makeIntent({ orderId: "ord_abc123" }),
			makeIntent({ orderId: "ord_xyz999" }),
		];
		const result = filterAndPageTransactions(intents, {
			from: null,
			to: null,
			search: "abc",
			page: 1,
			limit: 20,
		});
		expect(result.total).toBe(1);
		expect(result.transactions[0].orderId).toBe("ord_abc123");
	});

	it("filters by transaction ID search", () => {
		const intents: RevenueIntent[] = [
			makeIntent({ id: "txn_alpha_001" }),
			makeIntent({ id: "txn_beta_999" }),
		];
		const result = filterAndPageTransactions(intents, {
			from: null,
			to: null,
			search: "alpha",
			page: 1,
			limit: 20,
		});
		expect(result.total).toBe(1);
		expect(result.transactions[0].id).toBe("txn_alpha_001");
	});

	it("filters by providerIntentId search", () => {
		const intents: RevenueIntent[] = [
			makeIntent({ providerIntentId: "pi_stripe_abc" }),
			makeIntent({ providerIntentId: "pi_stripe_xyz" }),
		];
		const result = filterAndPageTransactions(intents, {
			from: null,
			to: null,
			search: "stripe_abc",
			page: 1,
			limit: 20,
		});
		expect(result.total).toBe(1);
		expect(result.transactions[0].providerIntentId).toBe("pi_stripe_abc");
	});

	it("filters by customerId search", () => {
		const intents: RevenueIntent[] = [
			makeIntent({ customerId: "cust_alice" }),
			makeIntent({ customerId: "cust_bob" }),
		];
		const result = filterAndPageTransactions(intents, {
			from: null,
			to: null,
			search: "cust_alice",
			page: 1,
			limit: 20,
		});
		expect(result.total).toBe(1);
		expect(result.transactions[0].customerId).toBe("cust_alice");
	});

	it("sorts newest first", () => {
		const intents: RevenueIntent[] = [
			makeIntent({ createdAt: new Date("2024-01-01"), amount: 111 }),
			makeIntent({ createdAt: new Date("2025-06-01"), amount: 999 }),
			makeIntent({ createdAt: new Date("2024-12-01"), amount: 555 }),
		];
		const result = filterAndPageTransactions(intents, {
			from: null,
			to: null,
			page: 1,
			limit: 20,
		});
		expect(result.transactions[0].amount).toBe(999);
		expect(result.transactions[2].amount).toBe(111);
	});

	it("maps dates to Date objects", () => {
		const intents: RevenueIntent[] = [makeIntent()];
		const result = filterAndPageTransactions(intents, {
			from: null,
			to: null,
			page: 1,
			limit: 20,
		});
		expect(result.transactions[0].createdAt).toBeInstanceOf(Date);
		expect(result.transactions[0].updatedAt).toBeInstanceOf(Date);
	});
});

describe("escapeCSV", () => {
	it("returns empty string for null and undefined", () => {
		expect(escapeCSV(null)).toBe("");
		expect(escapeCSV(undefined)).toBe("");
	});

	it("returns plain string as-is", () => {
		expect(escapeCSV("hello")).toBe("hello");
	});

	it("wraps comma-containing strings in quotes", () => {
		expect(escapeCSV("hello, world")).toBe('"hello, world"');
	});

	it("escapes double-quotes inside quoted fields", () => {
		expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
	});

	it("wraps newline-containing strings in quotes", () => {
		expect(escapeCSV("line1\nline2")).toBe('"line1\nline2"');
	});

	it("handles numbers", () => {
		expect(escapeCSV(42)).toBe("42");
		expect(escapeCSV(3.14)).toBe("3.14");
	});
});

describe("buildCSV", () => {
	it("produces header as first line", () => {
		const csv = buildCSV([]);
		const lines = csv.split("\n");
		expect(lines[0]).toBe(
			"Date,Transaction ID,Status,Amount,Currency,Customer Email,Order ID,Provider ID",
		);
	});

	it("produces one data row per intent", () => {
		const intents: RevenueIntent[] = [
			makeIntent({ amount: 5000, email: "test@example.com" }),
			makeIntent({ amount: 2500 }),
		];
		const csv = buildCSV(intents);
		const lines = csv.split("\n");
		expect(lines).toHaveLength(3); // header + 2 rows
	});

	it("formats amount as dollars with 2 decimal places", () => {
		const intents: RevenueIntent[] = [makeIntent({ amount: 1999 })];
		const csv = buildCSV(intents);
		const dataLine = csv.split("\n")[1];
		expect(dataLine).toContain("19.99");
	});
});
