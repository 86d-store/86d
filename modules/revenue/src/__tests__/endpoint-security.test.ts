import { describe, expect, it } from "vitest";
import type { RevenueIntent } from "../service";
import {
	aggregateStats,
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

describe("revenue endpoint security", () => {
	describe("graceful degradation when payments controller absent", () => {
		it("stats returns all zeros without the controller", () => {
			const emptyStats = {
				totalVolume: 0,
				transactionCount: 0,
				averageValue: 0,
				currency: "USD",
				byStatus: {
					pending: 0,
					processing: 0,
					succeeded: 0,
					failed: 0,
					cancelled: 0,
					refunded: 0,
				},
				refundVolume: 0,
				refundCount: 0,
			};
			const result = aggregateStats([], null, null);
			expect(result).toEqual(emptyStats);
		});

		it("transaction list returns empty without the controller", () => {
			const result = filterAndPageTransactions([], {
				from: null,
				to: null,
				page: 1,
				limit: 20,
			});
			expect(result.transactions).toHaveLength(0);
			expect(result.total).toBe(0);
		});
	});

	describe("aggregation isolation", () => {
		it("total volume only counts succeeded — never pending or failed", () => {
			const intents: RevenueIntent[] = [
				makeIntent({ status: "succeeded", amount: 1000 }),
				makeIntent({ status: "pending", amount: 9999 }),
				makeIntent({ status: "failed", amount: 9999 }),
				makeIntent({ status: "cancelled", amount: 9999 }),
			];
			const stats = aggregateStats(intents, null, null);
			expect(stats.totalVolume).toBe(1000);
		});

		it("refund volume does not inflate revenue", () => {
			const intents: RevenueIntent[] = [
				makeIntent({ status: "succeeded", amount: 3000 }),
				makeIntent({ status: "refunded", amount: 5000 }),
			];
			const stats = aggregateStats(intents, null, null);
			expect(stats.totalVolume).toBe(3000);
			expect(stats.refundVolume).toBe(5000);
		});

		it("average value is undefined (0) with no succeeded transactions", () => {
			const intents: RevenueIntent[] = [
				makeIntent({ status: "pending" }),
				makeIntent({ status: "failed" }),
			];
			const stats = aggregateStats(intents, null, null);
			expect(stats.averageValue).toBe(0);
		});
	});

	describe("pagination does not leak cross-page data", () => {
		it("pages are non-overlapping", () => {
			const intents = Array.from({ length: 9 }, () => makeIntent());
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
			const page3 = filterAndPageTransactions(intents, {
				from: null,
				to: null,
				page: 3,
				limit: 3,
			});
			const all = [
				...page1.transactions.map((t) => t.id),
				...page2.transactions.map((t) => t.id),
				...page3.transactions.map((t) => t.id),
			];
			expect(new Set(all).size).toBe(9);
		});

		it("does not return more than requested limit", () => {
			const intents = Array.from({ length: 50 }, () => makeIntent());
			const result = filterAndPageTransactions(intents, {
				from: null,
				to: null,
				page: 1,
				limit: 10,
			});
			expect(result.transactions.length).toBeLessThanOrEqual(10);
		});
	});

	describe("CSV injection prevention", () => {
		it("wraps comma fields in double quotes", () => {
			expect(escapeCSV("hello, world")).toBe('"hello, world"');
		});

		it("escapes embedded double quotes", () => {
			expect(escapeCSV('"quoted"')).toBe('"""quoted"""');
		});

		it("wraps newlines in quotes to prevent row injection", () => {
			expect(escapeCSV("inject\nnew row")).toBe('"inject\nnew row"');
		});

		it("does not quote safe values (no injection vector)", () => {
			expect(escapeCSV("plain")).toBe("plain");
			expect(escapeCSV("12345")).toBe("12345");
		});
	});
});
