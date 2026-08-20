import { beforeEach, describe, expect, it } from "vitest";
import type { PaymentIntentStatus, RevenueIntent } from "../service";
import { filterAndPageTransactions } from "../service-impl";

/**
 * Store endpoint integration tests for the revenue module.
 *
 * These tests simulate the business logic executed by the store-facing endpoint:
 *
 * 1. list-transactions (/revenue/transactions): returns paginated transaction
 *    history for the authenticated customer, with optional status filtering.
 *    The endpoint delegates filtering and pagination to filterAndPageTransactions.
 */

// ── Helpers ────────────────────────────────────────────────────────────

function makeIntent(
	overrides: Partial<RevenueIntent> & { id?: string } = {},
): RevenueIntent {
	return {
		id: overrides.id ?? crypto.randomUUID(),
		amount: 2500,
		currency: "USD",
		status: "succeeded",
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

function simulateListTransactions(
	intents: RevenueIntent[],
	params: {
		status?: PaymentIntentStatus;
		page?: number;
		limit?: number;
	} = {},
) {
	return filterAndPageTransactions(intents, {
		from: null,
		to: null,
		status: params.status,
		page: params.page ?? 1,
		limit: params.limit ?? 10,
	});
}

// ── Tests: list-transactions ───────────────────────────────────────────

describe("store endpoint: list-transactions", () => {
	describe("empty state", () => {
		it("returns empty list when customer has no transactions", () => {
			const result = simulateListTransactions([]);
			expect(result.transactions).toHaveLength(0);
			expect(result.total).toBe(0);
		});
	});

	describe("basic listing", () => {
		let intents: RevenueIntent[];

		beforeEach(() => {
			intents = [
				makeIntent({ id: "pi_1", status: "succeeded", amount: 1000 }),
				makeIntent({ id: "pi_2", status: "pending", amount: 2000 }),
				makeIntent({ id: "pi_3", status: "failed", amount: 500 }),
			];
		});

		it("returns all transactions when no filter applied", () => {
			const result = simulateListTransactions(intents);
			expect(result.total).toBe(3);
			expect(result.transactions).toHaveLength(3);
		});

		it("returns transactions with required fields", () => {
			const result = simulateListTransactions(intents);
			const tx = result.transactions[0];
			expect(tx).toHaveProperty("id");
			expect(tx).toHaveProperty("amount");
			expect(tx).toHaveProperty("currency");
			expect(tx).toHaveProperty("status");
			expect(tx).toHaveProperty("createdAt");
		});
	});

	describe("status filtering", () => {
		let intents: RevenueIntent[];

		beforeEach(() => {
			intents = [
				makeIntent({ status: "succeeded", amount: 5000 }),
				makeIntent({ status: "succeeded", amount: 3000 }),
				makeIntent({ status: "pending", amount: 1000 }),
				makeIntent({ status: "refunded", amount: 2000 }),
				makeIntent({ status: "failed", amount: 500 }),
			];
		});

		it("filters to only succeeded transactions", () => {
			const result = simulateListTransactions(intents, {
				status: "succeeded",
			});
			expect(result.total).toBe(2);
			for (const tx of result.transactions) {
				expect(tx.status).toBe("succeeded");
			}
		});

		it("filters to only pending transactions", () => {
			const result = simulateListTransactions(intents, {
				status: "pending",
			});
			expect(result.total).toBe(1);
			expect(result.transactions[0].status).toBe("pending");
		});

		it("filters to only refunded transactions", () => {
			const result = simulateListTransactions(intents, {
				status: "refunded",
			});
			expect(result.total).toBe(1);
			expect(result.transactions[0].status).toBe("refunded");
		});

		it("returns empty when no transactions match the filter", () => {
			const result = simulateListTransactions(intents, {
				status: "cancelled",
			});
			expect(result.total).toBe(0);
			expect(result.transactions).toHaveLength(0);
		});
	});

	describe("pagination", () => {
		let intents: RevenueIntent[];

		beforeEach(() => {
			intents = Array.from({ length: 25 }, (_, i) =>
				makeIntent({ id: `pi_${i}`, amount: (i + 1) * 100 }),
			);
		});

		it("returns the first page with default limit", () => {
			const result = simulateListTransactions(intents, { limit: 10 });
			expect(result.transactions).toHaveLength(10);
			expect(result.total).toBe(25);
		});

		it("returns the second page correctly", () => {
			const page1 = simulateListTransactions(intents, { page: 1, limit: 10 });
			const page2 = simulateListTransactions(intents, { page: 2, limit: 10 });

			const page1Ids = page1.transactions.map((t) => t.id);
			const page2Ids = page2.transactions.map((t) => t.id);

			// Pages should not overlap
			for (const id of page2Ids) {
				expect(page1Ids).not.toContain(id);
			}
		});

		it("returns the partial last page", () => {
			const result = simulateListTransactions(intents, { page: 3, limit: 10 });
			expect(result.transactions).toHaveLength(5);
			expect(result.total).toBe(25);
		});

		it("returns empty for a page beyond total", () => {
			const result = simulateListTransactions(intents, { page: 10, limit: 10 });
			expect(result.transactions).toHaveLength(0);
			expect(result.total).toBe(25);
		});

		it("respects a custom limit", () => {
			const result = simulateListTransactions(intents, {
				page: 1,
				limit: 5,
			});
			expect(result.transactions).toHaveLength(5);
		});
	});

	describe("ordering", () => {
		it("returns transactions in reverse chronological order (newest first)", () => {
			const now = Date.now();
			const intents: RevenueIntent[] = [
				makeIntent({
					id: "pi_old",
					createdAt: new Date(now - 10_000),
					updatedAt: new Date(now - 10_000),
				}),
				makeIntent({
					id: "pi_new",
					createdAt: new Date(now),
					updatedAt: new Date(now),
				}),
				makeIntent({
					id: "pi_mid",
					createdAt: new Date(now - 5_000),
					updatedAt: new Date(now - 5_000),
				}),
			];

			const result = simulateListTransactions(intents);
			const ids = result.transactions.map((t) => t.id);
			expect(ids[0]).toBe("pi_new");
			expect(ids[1]).toBe("pi_mid");
			expect(ids[2]).toBe("pi_old");
		});
	});
});
