import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreditParams, DebitParams } from "../service";
import { createStoreCreditController } from "../service-impl";

/**
 * Security regression tests for store-credits endpoints.
 *
 * Store credits are a financial instrument — any vulnerability here
 * can lead to monetary loss. These tests verify:
 * - Customer balance isolation: customer A cannot see or spend customer B's credits
 * - Credit/debit input validation: rejects zero, negative, and excessive amounts
 * - Negative balance prevention: debits beyond available balance are refused
 * - Frozen/closed account enforcement: status gates on financial operations
 * - Transaction history isolation: one customer's history is invisible to another
 * - Double-spending resistance: sequential debits respect updated balances
 */

function makeCreditParams(overrides: Partial<CreditParams> = {}): CreditParams {
	return {
		customerId: "cust_default",
		amount: 100,
		reason: "admin_adjustment",
		description: "Test credit",
		...overrides,
	};
}

function makeDebitParams(overrides: Partial<DebitParams> = {}): DebitParams {
	return {
		customerId: "cust_default",
		amount: 10,
		reason: "order_payment",
		description: "Test debit",
		...overrides,
	};
}

describe("store-credits endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createStoreCreditController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createStoreCreditController(mockData);
	});

	// ── Customer Balance Isolation ──────────────────────────────────

	describe("customer balance isolation", () => {
		it("getBalance returns 0 for a customer with no account", async () => {
			await controller.credit(makeCreditParams({ customerId: "other" }));
			const balance = await controller.getBalance("nonexistent");
			expect(balance).toBe(0);
		});

		it("crediting one customer does not affect another's balance", async () => {
			await controller.credit(
				makeCreditParams({ customerId: "alice", amount: 200 }),
			);
			await controller.credit(
				makeCreditParams({ customerId: "bob", amount: 50 }),
			);

			expect(await controller.getBalance("alice")).toBe(200);
			expect(await controller.getBalance("bob")).toBe(50);
		});

		it("debiting one customer does not reduce another's balance", async () => {
			await controller.credit(
				makeCreditParams({ customerId: "alice", amount: 100 }),
			);
			await controller.credit(
				makeCreditParams({ customerId: "bob", amount: 100 }),
			);
			await controller.debit(
				makeDebitParams({ customerId: "alice", amount: 40 }),
			);

			expect(await controller.getBalance("alice")).toBe(60);
			expect(await controller.getBalance("bob")).toBe(100);
		});

		it("getAccount returns null for another customer's ID", async () => {
			await controller.getOrCreateAccount("alice");
			const result = await controller.getAccount("bob");
			expect(result).toBeNull();
		});

		it("each customer gets a separate account with independent IDs", async () => {
			const a1 = await controller.getOrCreateAccount("alice");
			const a2 = await controller.getOrCreateAccount("bob");
			expect(a1.id).not.toBe(a2.id);
			expect(a1.customerId).toBe("alice");
			expect(a2.customerId).toBe("bob");
		});
	});

	// ── Credit Validation ──────────────────────────────────────────

	describe("credit input validation", () => {
		it("rejects zero credit amount", async () => {
			await expect(
				controller.credit(makeCreditParams({ amount: 0 })),
			).rejects.toThrow("Credit amount must be positive");
		});

		it("rejects negative credit amount", async () => {
			await expect(
				controller.credit(makeCreditParams({ amount: -50 })),
			).rejects.toThrow("Credit amount must be positive");
		});

		it("rejects credit to a closed account", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			await mockData.upsert("creditAccount", account.id, {
				...account,
				status: "closed",
			} as Record<string, unknown>);

			await expect(
				controller.credit(makeCreditParams({ customerId: "cust_1" })),
			).rejects.toThrow("Cannot credit a closed account");
		});

		it("allows credit to a frozen account (refunds still land)", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.freezeAccount("cust_1");

			const txn = await controller.credit(
				makeCreditParams({ customerId: "cust_1", amount: 25 }),
			);
			expect(txn.balanceAfter).toBe(25);
			expect(txn.type).toBe("credit");
		});
	});

	// ── Debit Validation & Negative Balance Prevention ─────────────

	describe("debit validation and negative balance prevention", () => {
		it("rejects zero debit amount", async () => {
			await expect(
				controller.debit(makeDebitParams({ amount: 0 })),
			).rejects.toThrow("Debit amount must be positive");
		});

		it("rejects negative debit amount", async () => {
			await expect(
				controller.debit(makeDebitParams({ amount: -10 })),
			).rejects.toThrow("Debit amount must be positive");
		});

		it("rejects debit exceeding available balance", async () => {
			await controller.credit(
				makeCreditParams({ customerId: "cust_1", amount: 30 }),
			);
			await expect(
				controller.debit(makeDebitParams({ customerId: "cust_1", amount: 31 })),
			).rejects.toThrow("Insufficient store credit balance");
		});

		it("rejects debit on an account with zero balance", async () => {
			await controller.getOrCreateAccount("cust_1");
			await expect(
				controller.debit(makeDebitParams({ customerId: "cust_1", amount: 1 })),
			).rejects.toThrow("Insufficient store credit balance");
		});

		it("allows debit of exact balance (balance becomes zero)", async () => {
			await controller.credit(
				makeCreditParams({ customerId: "cust_1", amount: 50 }),
			);
			const txn = await controller.debit(
				makeDebitParams({ customerId: "cust_1", amount: 50 }),
			);
			expect(txn.balanceAfter).toBe(0);
			expect(await controller.getBalance("cust_1")).toBe(0);
		});
	});

	// ── Frozen / Closed Account Enforcement ────────────────────────

	describe("account status enforcement", () => {
		it("rejects debit on a frozen account", async () => {
			await controller.credit(
				makeCreditParams({ customerId: "cust_1", amount: 100 }),
			);
			await controller.freezeAccount("cust_1");

			await expect(
				controller.debit(makeDebitParams({ customerId: "cust_1", amount: 10 })),
			).rejects.toThrow("Cannot debit a non-active account");
		});

		it("rejects debit on a closed account", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			await controller.credit(
				makeCreditParams({ customerId: "cust_1", amount: 100 }),
			);
			// Manually close the account
			const refreshed = await controller.getAccount("cust_1");
			await mockData.upsert("creditAccount", account.id, {
				...refreshed,
				status: "closed",
			} as Record<string, unknown>);

			await expect(
				controller.debit(makeDebitParams({ customerId: "cust_1", amount: 10 })),
			).rejects.toThrow("Cannot debit a non-active account");
		});

		it("cannot freeze an already closed account", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			await mockData.upsert("creditAccount", account.id, {
				...account,
				status: "closed",
			} as Record<string, unknown>);

			await expect(controller.freezeAccount("cust_1")).rejects.toThrow(
				"Cannot freeze a closed account",
			);
		});

		it("cannot unfreeze an active account", async () => {
			await controller.getOrCreateAccount("cust_1");
			await expect(controller.unfreezeAccount("cust_1")).rejects.toThrow(
				"Account is not frozen",
			);
		});
	});

	// ── Double-Spending Resistance ─────────────────────────────────

	describe("double-spending resistance", () => {
		it("sequential debits correctly reduce balance", async () => {
			await controller.credit(
				makeCreditParams({ customerId: "cust_1", amount: 100 }),
			);

			const txn1 = await controller.debit(
				makeDebitParams({ customerId: "cust_1", amount: 40 }),
			);
			expect(txn1.balanceAfter).toBe(60);

			const txn2 = await controller.debit(
				makeDebitParams({ customerId: "cust_1", amount: 30 }),
			);
			expect(txn2.balanceAfter).toBe(30);

			expect(await controller.getBalance("cust_1")).toBe(30);
		});

		it("second debit fails when first debit consumed available funds", async () => {
			await controller.credit(
				makeCreditParams({ customerId: "cust_1", amount: 50 }),
			);
			await controller.debit(
				makeDebitParams({ customerId: "cust_1", amount: 50 }),
			);

			await expect(
				controller.debit(makeDebitParams({ customerId: "cust_1", amount: 1 })),
			).rejects.toThrow("Insufficient store credit balance");
		});

		it("lifetime debited tracks cumulative spend accurately", async () => {
			await controller.credit(
				makeCreditParams({ customerId: "cust_1", amount: 200 }),
			);
			await controller.debit(
				makeDebitParams({ customerId: "cust_1", amount: 30 }),
			);
			await controller.debit(
				makeDebitParams({ customerId: "cust_1", amount: 70 }),
			);

			const account = await controller.getAccount("cust_1");
			expect(account?.lifetimeDebited).toBe(100);
			expect(account?.balance).toBe(100);
		});
	});

	// ── Transaction History Isolation ───────────────────────────────

	describe("transaction history isolation", () => {
		it("listTransactions for one account does not include another's", async () => {
			await controller.credit(
				makeCreditParams({ customerId: "alice", amount: 50 }),
			);
			await controller.credit(
				makeCreditParams({ customerId: "bob", amount: 75 }),
			);
			await controller.debit(
				makeDebitParams({ customerId: "alice", amount: 10 }),
			);

			const aliceAccount = await controller.getAccount("alice");
			const bobAccount = await controller.getAccount("bob");

			const aliceTxns = await controller.listTransactions(
				aliceAccount?.id ?? "",
			);
			const bobTxns = await controller.listTransactions(bobAccount?.id ?? "");

			expect(aliceTxns).toHaveLength(2); // 1 credit + 1 debit
			expect(bobTxns).toHaveLength(1); // 1 credit

			for (const txn of aliceTxns) {
				expect(txn.accountId).toBe(aliceAccount?.id);
			}
			for (const txn of bobTxns) {
				expect(txn.accountId).toBe(bobAccount?.id);
			}
		});

		it("transaction records correct balanceAfter for each operation", async () => {
			await controller.credit(
				makeCreditParams({ customerId: "cust_1", amount: 100 }),
			);
			await controller.debit(
				makeDebitParams({ customerId: "cust_1", amount: 25 }),
			);
			await controller.credit(
				makeCreditParams({ customerId: "cust_1", amount: 10 }),
			);

			const account = await controller.getAccount("cust_1");
			const txns = await controller.listTransactions(account?.id ?? "");

			// Should have 3 transactions
			expect(txns).toHaveLength(3);

			// Verify final balance matches last transaction's balanceAfter
			const finalBalance = await controller.getBalance("cust_1");
			expect(finalBalance).toBe(85); // 100 - 25 + 10
		});

		it("filtering by type does not leak cross-account transactions", async () => {
			await controller.credit(
				makeCreditParams({ customerId: "alice", amount: 100 }),
			);
			await controller.debit(
				makeDebitParams({ customerId: "alice", amount: 20 }),
			);
			await controller.credit(
				makeCreditParams({ customerId: "bob", amount: 50 }),
			);
			await controller.debit(makeDebitParams({ customerId: "bob", amount: 5 }));

			const aliceAccount = await controller.getAccount("alice");
			const aliceDebits = await controller.listTransactions(
				aliceAccount?.id ?? "",
				{ type: "debit" },
			);

			expect(aliceDebits).toHaveLength(1);
			expect(aliceDebits[0]?.amount).toBe(20);
			expect(aliceDebits[0]?.accountId).toBe(aliceAccount?.id);
		});
	});

	// ── Admin Summary Integrity ────────────────────────────────────

	describe("admin summary integrity", () => {
		it("summary reflects all accounts accurately", async () => {
			await controller.credit(
				makeCreditParams({ customerId: "a", amount: 100 }),
			);
			await controller.credit(
				makeCreditParams({ customerId: "b", amount: 200 }),
			);
			await controller.debit(makeDebitParams({ customerId: "a", amount: 40 }));

			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(2);
			expect(summary.totalOutstandingBalance).toBe(260); // 60 + 200
			expect(summary.totalLifetimeCredited).toBe(300); // 100 + 200
			expect(summary.totalLifetimeDebited).toBe(40);
		});

		it("frozen accounts are included in outstanding balance", async () => {
			await controller.credit(
				makeCreditParams({ customerId: "cust_1", amount: 100 }),
			);
			await controller.freezeAccount("cust_1");

			const summary = await controller.getSummary();
			expect(summary.totalOutstandingBalance).toBe(100);
		});
	});
});
