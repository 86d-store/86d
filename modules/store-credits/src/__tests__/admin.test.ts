import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createStoreCreditController } from "../service-impl";

/**
 * Admin workflow and edge-case tests for the store-credits module.
 *
 * Covers: account management, freeze/unfreeze flows, credit/debit edge cases,
 * transaction listing, summary analytics, multi-customer isolation.
 */

describe("store-credits — admin workflows", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createStoreCreditController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createStoreCreditController(mockData);
	});

	// ── Account lifecycle ──────────────────────────────────────────

	describe("account lifecycle", () => {
		it("getOrCreateAccount creates on first call", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			expect(account.customerId).toBe("cust_1");
			expect(account.balance).toBe(0);
			expect(account.status).toBe("active");
			expect(account.currency).toBe("USD");
		});

		it("getOrCreateAccount returns existing on second call", async () => {
			const first = await controller.getOrCreateAccount("cust_1");
			const second = await controller.getOrCreateAccount("cust_1");
			expect(first.id).toBe(second.id);
		});

		it("getAccount returns null for non-existent customer", async () => {
			const result = await controller.getAccount("nonexistent");
			expect(result).toBeNull();
		});

		it("getAccountById returns null for non-existent id", async () => {
			const result = await controller.getAccountById("fake-id");
			expect(result).toBeNull();
		});

		it("getAccountById returns account by id", async () => {
			const created = await controller.getOrCreateAccount("cust_1");
			const fetched = await controller.getAccountById(created.id);
			expect(fetched?.customerId).toBe("cust_1");
		});
	});

	// ── Freeze / unfreeze ──────────────────────────────────────────

	describe("freeze and unfreeze", () => {
		it("freezes an active account", async () => {
			await controller.getOrCreateAccount("cust_1");
			const frozen = await controller.freezeAccount("cust_1");
			expect(frozen.status).toBe("frozen");
		});

		it("unfreezes a frozen account", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.freezeAccount("cust_1");
			const unfrozen = await controller.unfreezeAccount("cust_1");
			expect(unfrozen.status).toBe("active");
		});

		it("cannot unfreeze a non-frozen account", async () => {
			await controller.getOrCreateAccount("cust_1");
			await expect(controller.unfreezeAccount("cust_1")).rejects.toThrow(
				"Account is not frozen",
			);
		});

		it("freeze preserves balance", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 5000,
				reason: "return_refund",
				description: "Return refund",
			});
			const frozen = await controller.freezeAccount("cust_1");
			expect(frozen.balance).toBe(5000);
		});

		it("cannot debit a frozen account", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 5000,
				reason: "return_refund",
				description: "Refund",
			});
			await controller.freezeAccount("cust_1");
			await expect(
				controller.debit({
					customerId: "cust_1",
					amount: 1000,
					reason: "order_payment",
					description: "Purchase",
				}),
			).rejects.toThrow("Cannot debit a non-active account");
		});

		it("can credit a frozen account", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.freezeAccount("cust_1");
			const txn = await controller.credit({
				customerId: "cust_1",
				amount: 1000,
				reason: "admin_adjustment",
				description: "Goodwill credit",
			});
			expect(txn.amount).toBe(1000);
		});

		it("can freeze and unfreeze multiple times", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.freezeAccount("cust_1");
			await controller.unfreezeAccount("cust_1");
			await controller.freezeAccount("cust_1");
			const account = await controller.getAccount("cust_1");
			expect(account?.status).toBe("frozen");
		});
	});

	// ── Credit edge cases ──────────────────────────────────────────

	describe("credit edge cases", () => {
		it("rejects zero credit", async () => {
			await expect(
				controller.credit({
					customerId: "cust_1",
					amount: 0,
					reason: "other",
					description: "Test",
				}),
			).rejects.toThrow("Credit amount must be positive");
		});

		it("rejects negative credit", async () => {
			await expect(
				controller.credit({
					customerId: "cust_1",
					amount: -100,
					reason: "other",
					description: "Test",
				}),
			).rejects.toThrow("Credit amount must be positive");
		});

		it("accumulates multiple credits", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 1000,
				reason: "return_refund",
				description: "Refund 1",
			});
			await controller.credit({
				customerId: "cust_1",
				amount: 2000,
				reason: "return_refund",
				description: "Refund 2",
			});
			await controller.credit({
				customerId: "cust_1",
				amount: 500,
				reason: "admin_adjustment",
				description: "Goodwill",
			});

			const balance = await controller.getBalance("cust_1");
			expect(balance).toBe(3500);
		});

		it("tracks lifetimeCredited correctly across multiple credits", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 1000,
				reason: "return_refund",
				description: "R1",
			});
			await controller.credit({
				customerId: "cust_1",
				amount: 2000,
				reason: "return_refund",
				description: "R2",
			});

			const account = await controller.getAccount("cust_1");
			expect(account?.lifetimeCredited).toBe(3000);
		});

		it("credit transaction records balanceAfter", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 1000,
				reason: "return_refund",
				description: "R1",
			});
			const txn = await controller.credit({
				customerId: "cust_1",
				amount: 2000,
				reason: "return_refund",
				description: "R2",
			});
			expect(txn.balanceAfter).toBe(3000);
		});

		it("credit with all optional fields", async () => {
			const txn = await controller.credit({
				customerId: "cust_1",
				amount: 1000,
				reason: "return_refund",
				description: "Order #123 return",
				referenceType: "order",
				referenceId: "order_123",
				metadata: { source: "return" },
			});
			expect(txn.description).toBe("Order #123 return");
			expect(txn.referenceType).toBe("order");
			expect(txn.referenceId).toBe("order_123");
			expect(txn.metadata).toEqual({ source: "return" });
		});

		it("handles very large credit amounts", async () => {
			const txn = await controller.credit({
				customerId: "cust_1",
				amount: 99999999,
				reason: "admin_adjustment",
				description: "Large adjustment",
			});
			expect(txn.amount).toBe(99999999);
			expect(txn.balanceAfter).toBe(99999999);
		});
	});

	// ── Debit edge cases ───────────────────────────────────────────

	describe("debit edge cases", () => {
		it("rejects zero debit", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 5000,
				reason: "return_refund",
				description: "Refund",
			});
			await expect(
				controller.debit({
					customerId: "cust_1",
					amount: 0,
					reason: "other",
					description: "Test",
				}),
			).rejects.toThrow("Debit amount must be positive");
		});

		it("rejects negative debit", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 5000,
				reason: "return_refund",
				description: "Refund",
			});
			await expect(
				controller.debit({
					customerId: "cust_1",
					amount: -100,
					reason: "other",
					description: "Test",
				}),
			).rejects.toThrow("Debit amount must be positive");
		});

		it("rejects debit exceeding balance", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 1000,
				reason: "return_refund",
				description: "Refund",
			});
			await expect(
				controller.debit({
					customerId: "cust_1",
					amount: 1001,
					reason: "order_payment",
					description: "Purchase",
				}),
			).rejects.toThrow("Insufficient store credit balance");
		});

		it("allows debit of exact balance (drains to zero)", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 3000,
				reason: "return_refund",
				description: "Refund",
			});
			const txn = await controller.debit({
				customerId: "cust_1",
				amount: 3000,
				reason: "order_payment",
				description: "Purchase",
			});
			expect(txn.balanceAfter).toBe(0);
			const balance = await controller.getBalance("cust_1");
			expect(balance).toBe(0);
		});

		it("tracks lifetimeDebited across multiple debits", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 10000,
				reason: "return_refund",
				description: "Refund",
			});
			await controller.debit({
				customerId: "cust_1",
				amount: 3000,
				reason: "order_payment",
				description: "P1",
			});
			await controller.debit({
				customerId: "cust_1",
				amount: 2000,
				reason: "order_payment",
				description: "P2",
			});

			const account = await controller.getAccount("cust_1");
			expect(account?.lifetimeDebited).toBe(5000);
			expect(account?.balance).toBe(5000);
		});

		it("debit on new account fails (zero balance)", async () => {
			await expect(
				controller.debit({
					customerId: "cust_1",
					amount: 100,
					reason: "other",
					description: "Test",
				}),
			).rejects.toThrow("Insufficient store credit balance");
		});
	});

	// ── Balance queries ────────────────────────────────────────────

	describe("balance queries", () => {
		it("getBalance returns 0 for non-existent customer", async () => {
			const balance = await controller.getBalance("nonexistent");
			expect(balance).toBe(0);
		});

		it("getBalance reflects credits and debits", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 5000,
				reason: "return_refund",
				description: "Refund",
			});
			await controller.debit({
				customerId: "cust_1",
				amount: 2000,
				reason: "order_payment",
				description: "Purchase",
			});
			expect(await controller.getBalance("cust_1")).toBe(3000);
		});
	});

	// ── Transaction listing ────────────────────────────────────────

	describe("transaction listing", () => {
		it("lists all transactions for an account", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			await controller.credit({
				customerId: "cust_1",
				amount: 5000,
				reason: "return_refund",
				description: "R1",
			});
			await controller.credit({
				customerId: "cust_1",
				amount: 3000,
				reason: "return_refund",
				description: "R2",
			});
			await controller.debit({
				customerId: "cust_1",
				amount: 1000,
				reason: "order_payment",
				description: "P1",
			});

			const txns = await controller.listTransactions(account.id, {});
			expect(txns).toHaveLength(3);
		});

		it("filters transactions by type", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			await controller.credit({
				customerId: "cust_1",
				amount: 5000,
				reason: "return_refund",
				description: "Refund",
			});
			await controller.debit({
				customerId: "cust_1",
				amount: 1000,
				reason: "order_payment",
				description: "Purchase",
			});

			const credits = await controller.listTransactions(account.id, {
				type: "credit",
			});
			expect(credits).toHaveLength(1);
			expect(credits[0].type).toBe("credit");

			const debits = await controller.listTransactions(account.id, {
				type: "debit",
			});
			expect(debits).toHaveLength(1);
			expect(debits[0].type).toBe("debit");
		});

		it("filters transactions by reason", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			await controller.credit({
				customerId: "cust_1",
				amount: 1000,
				reason: "return_refund",
				description: "Refund",
			});
			await controller.credit({
				customerId: "cust_1",
				amount: 500,
				reason: "admin_adjustment",
				description: "Goodwill",
			});

			const refunds = await controller.listTransactions(account.id, {
				reason: "return_refund",
			});
			expect(refunds).toHaveLength(1);
			expect(refunds[0].amount).toBe(1000);
		});

		it("paginates transactions", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			for (let i = 0; i < 10; i++) {
				await controller.credit({
					customerId: "cust_1",
					amount: 100 * (i + 1),
					reason: "return_refund",
					description: `Refund ${i + 1}`,
				});
			}

			const page1 = await controller.listTransactions(account.id, {
				take: 3,
				skip: 0,
			});
			const page2 = await controller.listTransactions(account.id, {
				take: 3,
				skip: 3,
			});
			expect(page1).toHaveLength(3);
			expect(page2).toHaveLength(3);
		});

		it("returns empty for non-existent account", async () => {
			const txns = await controller.listTransactions("fake-id", {});
			expect(txns).toHaveLength(0);
		});
	});

	// ── Account listing ────────────────────────────────────────────

	describe("account listing", () => {
		it("lists all accounts", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.getOrCreateAccount("cust_2");
			await controller.getOrCreateAccount("cust_3");

			const accounts = await controller.listAccounts({});
			expect(accounts).toHaveLength(3);
		});

		it("filters accounts by status", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.getOrCreateAccount("cust_2");
			await controller.freezeAccount("cust_2");

			const active = await controller.listAccounts({ status: "active" });
			expect(active).toHaveLength(1);
			expect(active[0].customerId).toBe("cust_1");

			const frozen = await controller.listAccounts({ status: "frozen" });
			expect(frozen).toHaveLength(1);
			expect(frozen[0].customerId).toBe("cust_2");
		});

		it("paginates accounts", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.getOrCreateAccount(`cust_${i}`);
			}
			const page = await controller.listAccounts({ take: 3, skip: 2 });
			expect(page).toHaveLength(3);
		});
	});

	// ── Summary analytics ──────────────────────────────────────────

	describe("summary analytics", () => {
		it("returns zeros on empty database", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(0);
			expect(summary.totalOutstandingBalance).toBe(0);
			expect(summary.totalLifetimeCredited).toBe(0);
			expect(summary.totalLifetimeDebited).toBe(0);
		});

		it("aggregates across multiple accounts", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 5000,
				reason: "return_refund",
				description: "Refund",
			});
			await controller.credit({
				customerId: "cust_2",
				amount: 3000,
				reason: "return_refund",
				description: "Refund",
			});
			await controller.debit({
				customerId: "cust_1",
				amount: 1000,
				reason: "order_payment",
				description: "Purchase",
			});

			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(2);
			expect(summary.totalOutstandingBalance).toBe(7000);
			expect(summary.totalLifetimeCredited).toBe(8000);
			expect(summary.totalLifetimeDebited).toBe(1000);
		});

		it("includes frozen account balances in outstanding total", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 5000,
				reason: "return_refund",
				description: "Refund",
			});
			await controller.freezeAccount("cust_1");

			const summary = await controller.getSummary();
			expect(summary.totalOutstandingBalance).toBe(5000);
		});
	});

	// ── Multi-customer isolation ───────────────────────────────────

	describe("multi-customer isolation", () => {
		it("each customer has independent balance", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 5000,
				reason: "return_refund",
				description: "Refund",
			});
			await controller.credit({
				customerId: "cust_2",
				amount: 3000,
				reason: "return_refund",
				description: "Refund",
			});

			expect(await controller.getBalance("cust_1")).toBe(5000);
			expect(await controller.getBalance("cust_2")).toBe(3000);
		});

		it("debit from one customer does not affect another", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 5000,
				reason: "return_refund",
				description: "Refund",
			});
			await controller.credit({
				customerId: "cust_2",
				amount: 5000,
				reason: "return_refund",
				description: "Refund",
			});
			await controller.debit({
				customerId: "cust_1",
				amount: 3000,
				reason: "order_payment",
				description: "Purchase",
			});

			expect(await controller.getBalance("cust_1")).toBe(2000);
			expect(await controller.getBalance("cust_2")).toBe(5000);
		});

		it("freezing one account does not freeze another", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.getOrCreateAccount("cust_2");
			await controller.freezeAccount("cust_1");

			const acc1 = await controller.getAccount("cust_1");
			const acc2 = await controller.getAccount("cust_2");
			expect(acc1?.status).toBe("frozen");
			expect(acc2?.status).toBe("active");
		});
	});
});
