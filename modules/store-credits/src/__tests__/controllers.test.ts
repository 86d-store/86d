import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createStoreCreditController } from "../service-impl";

describe("store-credits controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createStoreCreditController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createStoreCreditController(mockData);
	});

	// ── Account lifecycle ────────────────────────────────────────────

	describe("account lifecycle", () => {
		it("newly created account has timestamps", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			expect(account.createdAt).toBeInstanceOf(Date);
			expect(account.updatedAt).toBeInstanceOf(Date);
		});

		it("freeze/unfreeze cycle preserves balance", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 100,
				reason: "admin_adjustment",
				description: "Initial",
			});
			await controller.freezeAccount("cust_1");
			const frozen = await controller.getAccount("cust_1");
			expect(frozen?.balance).toBe(100);

			await controller.unfreezeAccount("cust_1");
			const unfrozen = await controller.getAccount("cust_1");
			expect(unfrozen?.balance).toBe(100);
			expect(unfrozen?.status).toBe("active");
		});

		it("double freeze is idempotent", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.freezeAccount("cust_1");
			// Freezing again should work (already frozen, getOrCreateAccount returns frozen)
			const result = await controller.freezeAccount("cust_1");
			expect(result.status).toBe("frozen");
		});

		it("closed account cannot be debited", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			await controller.credit({
				customerId: "cust_1",
				amount: 100,
				reason: "admin_adjustment",
				description: "Initial",
			});
			await mockData.upsert("creditAccount", account.id, {
				...account,
				balance: 100,
				lifetimeCredited: 100,
				status: "closed",
			} as Record<string, unknown>);

			await expect(
				controller.debit({
					customerId: "cust_1",
					amount: 10,
					reason: "order_payment",
					description: "Test",
				}),
			).rejects.toThrow("Cannot debit a non-active account");
		});

		it("getOrCreateAccount returns same account for same customer after operations", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 50,
				reason: "admin_adjustment",
				description: "Credit",
			});
			const account = await controller.getOrCreateAccount("cust_1");
			expect(account.balance).toBe(50);
		});
	});

	// ── Credit edge cases ────────────────────────────────────────────

	describe("credit — edge cases", () => {
		it("stores metadata on credit transaction", async () => {
			const txn = await controller.credit({
				customerId: "cust_1",
				amount: 25,
				reason: "promotional",
				description: "Holiday promo",
				metadata: { campaignId: "camp_123", source: "email" },
			});
			expect(txn.metadata).toEqual({
				campaignId: "camp_123",
				source: "email",
			});
		});

		it("handles fractional amounts precisely", async () => {
			const txn1 = await controller.credit({
				customerId: "cust_1",
				amount: 0.01,
				reason: "other",
				description: "Penny",
			});
			expect(txn1.balanceAfter).toBe(0.01);

			const txn2 = await controller.credit({
				customerId: "cust_1",
				amount: 0.02,
				reason: "other",
				description: "Two pennies",
			});
			expect(txn2.balanceAfter).toBeCloseTo(0.03);
		});

		it("creates unique transaction IDs", async () => {
			const txn1 = await controller.credit({
				customerId: "cust_1",
				amount: 10,
				reason: "admin_adjustment",
				description: "First",
			});
			const txn2 = await controller.credit({
				customerId: "cust_1",
				amount: 10,
				reason: "admin_adjustment",
				description: "Second",
			});
			expect(txn1.id).not.toBe(txn2.id);
		});

		it("each credit reason is stored correctly", async () => {
			const reasons = [
				"return_refund",
				"admin_adjustment",
				"referral_reward",
				"gift_card_conversion",
				"promotional",
				"other",
			] as const;

			for (const reason of reasons) {
				const txn = await controller.credit({
					customerId: `cust_${reason}`,
					amount: 10,
					reason,
					description: `Test ${reason}`,
				});
				expect(txn.reason).toBe(reason);
			}
		});

		it("large credit amount works correctly", async () => {
			const txn = await controller.credit({
				customerId: "cust_1",
				amount: 999999.99,
				reason: "admin_adjustment",
				description: "Large credit",
			});
			expect(txn.balanceAfter).toBe(999999.99);
			expect(txn.amount).toBe(999999.99);
		});
	});

	// ── Debit edge cases ─────────────────────────────────────────────

	describe("debit — edge cases", () => {
		it("stores metadata on debit transaction", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 100,
				reason: "admin_adjustment",
				description: "Initial",
			});
			const txn = await controller.debit({
				customerId: "cust_1",
				amount: 30,
				reason: "order_payment",
				description: "Order",
				metadata: { orderId: "ord_456" },
			});
			expect(txn.metadata).toEqual({ orderId: "ord_456" });
		});

		it("stores reference type and ID on debit", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 100,
				reason: "admin_adjustment",
				description: "Initial",
			});
			const txn = await controller.debit({
				customerId: "cust_1",
				amount: 50,
				reason: "order_payment",
				description: "Order payment",
				referenceType: "order",
				referenceId: "ord_789",
			});
			expect(txn.referenceType).toBe("order");
			expect(txn.referenceId).toBe("ord_789");
		});

		it("throws on negative debit amount", async () => {
			await expect(
				controller.debit({
					customerId: "cust_1",
					amount: -10,
					reason: "other",
					description: "Negative",
				}),
			).rejects.toThrow("Debit amount must be positive");
		});

		it("multiple debits track lifetime correctly", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 100,
				reason: "admin_adjustment",
				description: "Initial",
			});
			await controller.debit({
				customerId: "cust_1",
				amount: 20,
				reason: "order_payment",
				description: "First",
			});
			await controller.debit({
				customerId: "cust_1",
				amount: 30,
				reason: "order_payment",
				description: "Second",
			});

			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(50);
			expect(account?.lifetimeDebited).toBe(50);
			expect(account?.lifetimeCredited).toBe(100);
		});

		it("debit on new customer with no account fails", async () => {
			await expect(
				controller.debit({
					customerId: "no_account",
					amount: 10,
					reason: "order_payment",
					description: "No funds",
				}),
			).rejects.toThrow("Insufficient store credit balance");
		});
	});

	// ── Transaction listing edge cases ───────────────────────────────

	describe("listTransactions — edge cases", () => {
		it("returns empty array for account with no transactions", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			const txns = await controller.listTransactions(account.id);
			expect(txns).toHaveLength(0);
		});

		it("skip pagination works correctly", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 10,
				reason: "admin_adjustment",
				description: "1",
			});
			await controller.credit({
				customerId: "cust_1",
				amount: 20,
				reason: "admin_adjustment",
				description: "2",
			});
			await controller.credit({
				customerId: "cust_1",
				amount: 30,
				reason: "admin_adjustment",
				description: "3",
			});

			const account = await controller.getAccount("cust_1");
			if (!account) throw new Error("Expected account");
			const page = await controller.listTransactions(account.id, {
				skip: 1,
				take: 1,
			});
			expect(page).toHaveLength(1);
		});

		it("combined type and reason filter", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 50,
				reason: "return_refund",
				description: "Return",
			});
			await controller.credit({
				customerId: "cust_1",
				amount: 20,
				reason: "promotional",
				description: "Promo",
			});
			await controller.debit({
				customerId: "cust_1",
				amount: 10,
				reason: "order_payment",
				description: "Order",
			});

			const account = await controller.getAccount("cust_1");
			if (!account) throw new Error("Expected account");

			const creditRefunds = await controller.listTransactions(account.id, {
				type: "credit",
				reason: "return_refund",
			});
			expect(creditRefunds).toHaveLength(1);
			expect(creditRefunds[0].amount).toBe(50);
		});

		it("transactions are scoped to account", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 10,
				reason: "admin_adjustment",
				description: "Cust 1",
			});
			await controller.credit({
				customerId: "cust_2",
				amount: 20,
				reason: "admin_adjustment",
				description: "Cust 2",
			});

			const account1 = await controller.getAccount("cust_1");
			const account2 = await controller.getAccount("cust_2");
			if (!account1 || !account2) throw new Error("Expected accounts");

			const txns1 = await controller.listTransactions(account1.id);
			const txns2 = await controller.listTransactions(account2.id);
			expect(txns1).toHaveLength(1);
			expect(txns2).toHaveLength(1);
		});
	});

	// ── Admin listing edge cases ─────────────────────────────────────

	describe("listAccounts — edge cases", () => {
		it("returns empty array when no accounts exist", async () => {
			const accounts = await controller.listAccounts();
			expect(accounts).toHaveLength(0);
		});

		it("skip pagination works", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.getOrCreateAccount("cust_2");
			await controller.getOrCreateAccount("cust_3");

			const page = await controller.listAccounts({ skip: 1, take: 1 });
			expect(page).toHaveLength(1);
		});

		it("filters active accounts", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.getOrCreateAccount("cust_2");
			await controller.freezeAccount("cust_2");

			const active = await controller.listAccounts({ status: "active" });
			expect(active).toHaveLength(1);
			expect(active[0].customerId).toBe("cust_1");
		});
	});

	// ── Summary edge cases ───────────────────────────────────────────

	describe("getSummary — edge cases", () => {
		it("includes frozen account balances in summary", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 100,
				reason: "admin_adjustment",
				description: "Active account",
			});
			await controller.credit({
				customerId: "cust_2",
				amount: 50,
				reason: "admin_adjustment",
				description: "Will freeze",
			});
			await controller.freezeAccount("cust_2");

			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(2);
			expect(summary.totalOutstandingBalance).toBe(150);
		});

		it("summary after full debit shows zero balance for that account", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 50,
				reason: "admin_adjustment",
				description: "Credit",
			});
			await controller.debit({
				customerId: "cust_1",
				amount: 50,
				reason: "order_payment",
				description: "Full spend",
			});

			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(1);
			expect(summary.totalOutstandingBalance).toBe(0);
			expect(summary.totalLifetimeCredited).toBe(50);
			expect(summary.totalLifetimeDebited).toBe(50);
		});

		it("summary with many accounts", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.credit({
					customerId: `cust_${i}`,
					amount: 10,
					reason: "promotional",
					description: `Promo ${i}`,
				});
			}

			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(10);
			expect(summary.totalOutstandingBalance).toBe(100);
			expect(summary.totalLifetimeCredited).toBe(100);
			expect(summary.totalLifetimeDebited).toBe(0);
		});
	});

	// ── Multi-customer scenarios ─────────────────────────────────────

	describe("multi-customer scenarios", () => {
		it("credits and debits across multiple customers are independent", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 100,
				reason: "admin_adjustment",
				description: "C1",
			});
			await controller.credit({
				customerId: "cust_2",
				amount: 200,
				reason: "admin_adjustment",
				description: "C2",
			});
			await controller.debit({
				customerId: "cust_1",
				amount: 50,
				reason: "order_payment",
				description: "C1 order",
			});

			expect(await controller.getBalance("cust_1")).toBe(50);
			expect(await controller.getBalance("cust_2")).toBe(200);
		});

		it("freezing one customer does not affect another", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 100,
				reason: "admin_adjustment",
				description: "C1",
			});
			await controller.credit({
				customerId: "cust_2",
				amount: 100,
				reason: "admin_adjustment",
				description: "C2",
			});
			await controller.freezeAccount("cust_1");

			// cust_2 can still debit
			const txn = await controller.debit({
				customerId: "cust_2",
				amount: 50,
				reason: "order_payment",
				description: "C2 order",
			});
			expect(txn.balanceAfter).toBe(50);

			// cust_1 cannot debit
			await expect(
				controller.debit({
					customerId: "cust_1",
					amount: 10,
					reason: "order_payment",
					description: "C1 order",
				}),
			).rejects.toThrow("Cannot debit a non-active account");
		});
	});
});
