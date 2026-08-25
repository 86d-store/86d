import { describe, expect, it } from "vitest";
import {
	isRevenueExportResult,
	isRevenueStats,
	isRevenueTransactionPage,
	resolveRevenueQuery,
} from "../admin/components/revenue-stats";

const validStats = {
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

describe("revenue admin stats guard", () => {
	it("fails closed when a completed query has no authoritative data", () => {
		expect(
			resolveRevenueQuery(
				{ data: undefined, isError: false, isLoading: false },
				isRevenueStats,
			),
		).toEqual({ status: "unavailable" });
		expect(
			resolveRevenueQuery(
				{ data: undefined, isError: false, isLoading: false },
				isRevenueTransactionPage,
			),
		).toEqual({ status: "unavailable" });
	});

	it("distinguishes loading from complete authoritative revenue data", () => {
		expect(
			resolveRevenueQuery(
				{ data: undefined, isError: false, isLoading: true },
				isRevenueStats,
			),
		).toEqual({ status: "loading" });
		expect(
			resolveRevenueQuery(
				{ data: validStats, isError: false, isLoading: false },
				isRevenueStats,
			),
		).toEqual({ data: validStats, status: "ready" });
	});

	it("accepts complete finite revenue statistics", () => {
		expect(isRevenueStats(validStats)).toBe(true);
	});

	it("rejects endpoint error envelopes and incomplete status totals", () => {
		expect(
			isRevenueStats({
				code: "payment_source_unavailable",
				error: "Authoritative revenue statistics are unavailable.",
				status: 503,
			}),
		).toBe(false);
		expect(isRevenueStats({ ...validStats, byStatus: undefined })).toBe(false);
	});

	it("rejects non-finite monetary values", () => {
		expect(isRevenueStats({ ...validStats, totalVolume: Number.NaN })).toBe(
			false,
		);
	});

	it("rejects revenue statistics with a currency Intl cannot format", () => {
		expect(isRevenueStats({ ...validStats, currency: "usd" })).toBe(true);
		for (const currency of ["???", "US", "USDD", "ÅAA"]) {
			expect(isRevenueStats({ ...validStats, currency })).toBe(false);
		}
	});

	it("rejects transactions with a currency Intl cannot format", () => {
		const transaction = {
			id: "txn_001",
			amount: 5000,
			currency: "usd",
			status: "succeeded",
			createdAt: "2026-08-25T00:00:00.000Z",
			updatedAt: "2026-08-25T00:00:00.000Z",
		};
		expect(
			isRevenueTransactionPage({ transactions: [transaction], total: 1 }),
		).toBe(true);
		for (const currency of ["???", "US", "USDD", "ÅAA"]) {
			expect(
				isRevenueTransactionPage({
					transactions: [{ ...transaction, currency }],
					total: 1,
				}),
			).toBe(false);
		}
	});

	it("rejects failure envelopes for transaction lists and exports", () => {
		const failure = {
			code: "REVENUE_SOURCE_UNAVAILABLE",
			error: "Authoritative revenue data is unavailable.",
			status: 503,
		};
		expect(isRevenueTransactionPage(failure)).toBe(false);
		expect(isRevenueExportResult(failure)).toBe(false);
		expect(isRevenueTransactionPage({ transactions: [], total: 0 })).toBe(true);
		expect(isRevenueExportResult({ csv: "header\n", count: 0 })).toBe(true);
	});
});
