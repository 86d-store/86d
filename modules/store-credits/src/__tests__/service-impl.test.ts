import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createStoreCreditController } from "../service-impl";

describe("createStoreCreditController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createStoreCreditController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createStoreCreditController(mockData);
	});

	// ── Account operations ────────────────────────────────────────────

	describe("getOrCreateAccount", () => {
		it("creates a new account for a new customer", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			expect(account.id).toBeDefined();
			expect(account.customerId).toBe("cust_1");
			expect(account.balance).toBe(0);
			expect(account.lifetimeCredited).toBe(0);
			expect(account.lifetimeDebited).toBe(0);
			expect(account.currency).toBe("USD");
			expect(account.status).toBe("active");
		});

		it("returns existing account on subsequent calls", async () => {
			const first = await controller.getOrCreateAccount("cust_1");
			const second = await controller.getOrCreateAccount("cust_1");
			expect(second.id).toBe(first.id);
		});

		it("creates separate accounts for different customers", async () => {
			const a1 = await controller.getOrCreateAccount("cust_1");
			const a2 = await controller.getOrCreateAccount("cust_2");
			expect(a1.id).not.toBe(a2.id);
		});
	});

	describe("getAccount", () => {
		it("returns null for non-existent customer", async () => {
			const account = await controller.getAccount("missing");
			expect(account).toBeNull();
		});

		it("returns existing account", async () => {
			await controller.getOrCreateAccount("cust_1");
			const account = await controller.getAccount("cust_1");
			expect(account?.customerId).toBe("cust_1");
		});
	});

	describe("getAccountById", () => {
		it("returns account by ID", async () => {
			const created = await controller.getOrCreateAccount("cust_1");
			const found = await controller.getAccountById(created.id);
			expect(found?.customerId).toBe("cust_1");
		});

		it("returns null for unknown ID", async () => {
			const found = await controller.getAccountById("unknown");
			expect(found).toBeNull();
		});
	});

	describe("freezeAccount", () => {
		it("freezes an active account", async () => {
			await controller.getOrCreateAccount("cust_1");
			const frozen = await controller.freezeAccount("cust_1");
			expect(frozen.status).toBe("frozen");
		});

		it("throws when freezing a closed account", async () => {
			// Create, then manually close by upsert
			const account = await controller.getOrCreateAccount("cust_1");
			await mockData.upsert("creditAccount", account.id, {
				...account,
				status: "closed",
			} as Record<string, unknown>);

			await expect(controller.freezeAccount("cust_1")).rejects.toThrow(
				"Cannot freeze a closed account",
			);
		});
	});

	describe("unfreezeAccount", () => {
		it("unfreezes a frozen account", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.freezeAccount("cust_1");
			const unfrozen = await controller.unfreezeAccount("cust_1");
			expect(unfrozen.status).toBe("active");
		});

		it("throws when unfreezing an active account", async () => {
			await controller.getOrCreateAccount("cust_1");
			await expect(controller.unfreezeAccount("cust_1")).rejects.toThrow(
				"Account is not frozen",
			);
		});
	});

	// ── Credit operations ─────────────────────────────────────────────

	describe("credit", () => {
		it("credits amount to customer account", async () => {
			const txn = await controller.credit({
				customerId: "cust_1",
				amount: 25.5,
				reason: "return_refund",
				description: "Return refund for order #123",
			});
			expect(txn.type).toBe("credit");
			expect(txn.amount).toBe(25.5);
			expect(txn.balanceAfter).toBe(25.5);
			expect(txn.reason).toBe("return_refund");
		});

		it("accumulates balance across multiple credits", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 10,
				reason: "admin_adjustment",
				description: "Initial credit",
			});
			const txn2 = await controller.credit({
				customerId: "cust_1",
				amount: 15,
				reason: "promotional",
				description: "Promo credit",
			});
			expect(txn2.balanceAfter).toBe(25);

			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(25);
			expect(account?.lifetimeCredited).toBe(25);
		});

		it("throws on non-positive amount", async () => {
			await expect(
				controller.credit({
					customerId: "cust_1",
					amount: 0,
					reason: "other",
					description: "zero",
				}),
			).rejects.toThrow("Credit amount must be positive");

			await expect(
				controller.credit({
					customerId: "cust_1",
					amount: -5,
					reason: "other",
					description: "negative",
				}),
			).rejects.toThrow("Credit amount must be positive");
		});

		it("throws when crediting a closed account", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			await mockData.upsert("creditAccount", account.id, {
				...account,
				status: "closed",
			} as Record<string, unknown>);

			await expect(
				controller.credit({
					customerId: "cust_1",
					amount: 10,
					reason: "other",
					description: "test",
				}),
			).rejects.toThrow("Cannot credit a closed account");
		});

		it("stores reference type and ID", async () => {
			const txn = await controller.credit({
				customerId: "cust_1",
				amount: 50,
				reason: "return_refund",
				description: "Return",
				referenceType: "return",
				referenceId: "ret_123",
			});
			expect(txn.referenceType).toBe("return");
			expect(txn.referenceId).toBe("ret_123");
		});

		it("allows crediting a frozen account", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.freezeAccount("cust_1");
			const txn = await controller.credit({
				customerId: "cust_1",
				amount: 10,
				reason: "return_refund",
				description: "Refund on frozen account",
			});
			expect(txn.balanceAfter).toBe(10);
		});
	});

	// ── Debit operations ──────────────────────────────────────────────

	describe("debit", () => {
		it("debits amount from customer account", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 50,
				reason: "admin_adjustment",
				description: "Initial",
			});
			const txn = await controller.debit({
				customerId: "cust_1",
				amount: 20,
				reason: "order_payment",
				description: "Order #456",
			});
			expect(txn.type).toBe("debit");
			expect(txn.amount).toBe(20);
			expect(txn.balanceAfter).toBe(30);

			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(30);
			expect(account?.lifetimeDebited).toBe(20);
		});

		it("throws on insufficient balance", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 10,
				reason: "admin_adjustment",
				description: "Small credit",
			});
			await expect(
				controller.debit({
					customerId: "cust_1",
					amount: 15,
					reason: "order_payment",
					description: "Too much",
				}),
			).rejects.toThrow("Insufficient store credit balance");
		});

		it("throws on non-positive amount", async () => {
			await expect(
				controller.debit({
					customerId: "cust_1",
					amount: 0,
					reason: "other",
					description: "zero",
				}),
			).rejects.toThrow("Debit amount must be positive");
		});

		it("throws when debiting a frozen account", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 50,
				reason: "admin_adjustment",
				description: "Initial",
			});
			await controller.freezeAccount("cust_1");
			await expect(
				controller.debit({
					customerId: "cust_1",
					amount: 10,
					reason: "order_payment",
					description: "Frozen debit",
				}),
			).rejects.toThrow("Cannot debit a non-active account");
		});

		it("allows exact balance debit", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 25,
				reason: "admin_adjustment",
				description: "Exact",
			});
			const txn = await controller.debit({
				customerId: "cust_1",
				amount: 25,
				reason: "order_payment",
				description: "Exact spend",
			});
			expect(txn.balanceAfter).toBe(0);
		});
	});

	// ── Balance ───────────────────────────────────────────────────────

	describe("getBalance", () => {
		it("returns 0 for non-existent customer", async () => {
			const balance = await controller.getBalance("nobody");
			expect(balance).toBe(0);
		});

		it("returns correct balance after operations", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 100,
				reason: "admin_adjustment",
				description: "Initial",
			});
			await controller.debit({
				customerId: "cust_1",
				amount: 30,
				reason: "order_payment",
				description: "Order",
			});
			const balance = await controller.getBalance("cust_1");
			expect(balance).toBe(70);
		});
	});

	// ── Transaction listing ───────────────────────────────────────────

	describe("listTransactions", () => {
		it("returns transactions in descending order", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 10,
				reason: "admin_adjustment",
				description: "First",
			});
			await controller.credit({
				customerId: "cust_1",
				amount: 20,
				reason: "promotional",
				description: "Second",
			});

			const account = await controller.getAccount("cust_1");
			if (!account) throw new Error("Expected account");
			const txns = await controller.listTransactions(account.id);
			expect(txns).toHaveLength(2);
		});

		it("filters by type", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 50,
				reason: "admin_adjustment",
				description: "Credit",
			});
			await controller.debit({
				customerId: "cust_1",
				amount: 10,
				reason: "order_payment",
				description: "Debit",
			});

			const account = await controller.getAccount("cust_1");
			if (!account) throw new Error("Expected account");
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

		it("filters by reason", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 10,
				reason: "return_refund",
				description: "Return",
			});
			await controller.credit({
				customerId: "cust_1",
				amount: 20,
				reason: "promotional",
				description: "Promo",
			});

			const account = await controller.getAccount("cust_1");
			if (!account) throw new Error("Expected account");
			const refunds = await controller.listTransactions(account.id, {
				reason: "return_refund",
			});
			expect(refunds).toHaveLength(1);
			expect(refunds[0].reason).toBe("return_refund");
		});

		it("supports pagination", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 10,
				reason: "admin_adjustment",
				description: "1",
			});
			await controller.credit({
				customerId: "cust_1",
				amount: 10,
				reason: "admin_adjustment",
				description: "2",
			});
			await controller.credit({
				customerId: "cust_1",
				amount: 10,
				reason: "admin_adjustment",
				description: "3",
			});

			const account = await controller.getAccount("cust_1");
			if (!account) throw new Error("Expected account");
			const page = await controller.listTransactions(account.id, {
				take: 2,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── Admin operations ──────────────────────────────────────────────

	describe("listAccounts", () => {
		it("returns all accounts", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.getOrCreateAccount("cust_2");
			const accounts = await controller.listAccounts();
			expect(accounts).toHaveLength(2);
		});

		it("filters by status", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.getOrCreateAccount("cust_2");
			await controller.freezeAccount("cust_2");

			const frozen = await controller.listAccounts({ status: "frozen" });
			expect(frozen).toHaveLength(1);
			expect(frozen[0].customerId).toBe("cust_2");
		});

		it("supports pagination", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.getOrCreateAccount("cust_2");
			await controller.getOrCreateAccount("cust_3");

			const page = await controller.listAccounts({ take: 2 });
			expect(page).toHaveLength(2);
		});
	});

	describe("getSummary", () => {
		it("returns zero summary for empty store", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(0);
			expect(summary.totalOutstandingBalance).toBe(0);
			expect(summary.totalLifetimeCredited).toBe(0);
			expect(summary.totalLifetimeDebited).toBe(0);
		});

		it("calculates correct summary", async () => {
			await controller.credit({
				customerId: "cust_1",
				amount: 100,
				reason: "admin_adjustment",
				description: "Test",
			});
			await controller.credit({
				customerId: "cust_2",
				amount: 50,
				reason: "promotional",
				description: "Promo",
			});
			await controller.debit({
				customerId: "cust_1",
				amount: 30,
				reason: "order_payment",
				description: "Order",
			});

			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(2);
			expect(summary.totalOutstandingBalance).toBe(120); // 70 + 50
			expect(summary.totalLifetimeCredited).toBe(150); // 100 + 50
			expect(summary.totalLifetimeDebited).toBe(30);
		});
	});
});
