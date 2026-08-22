import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createCustomerController } from "../service-impl";

/**
 * Tests for store (customer-facing) loyalty endpoints.
 *
 * The store endpoints at `/customers/me/loyalty` and `/customers/me/loyalty/history`
 * are thin auth-guarded wrappers around `getLoyaltyBalance` and `getLoyaltyHistory`.
 * These tests exercise the controller methods from the customer's perspective:
 * balance retrieval, history pagination, and isolation between customers.
 */

describe("store loyalty endpoints (controller layer)", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createCustomerController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createCustomerController(mockData);
	});

	describe("getLoyaltyBalance — customer self-service", () => {
		it("returns zero balance for a customer with no activity", async () => {
			const balance = await controller.getLoyaltyBalance("cust-new");
			expect(balance.customerId).toBe("cust-new");
			expect(balance.balance).toBe(0);
			expect(balance.totalEarned).toBe(0);
			expect(balance.totalRedeemed).toBe(0);
			expect(balance.transactionCount).toBe(0);
		});

		it("reflects earned points correctly", async () => {
			await controller.earnPoints({
				customerId: "cust-store-1",
				points: 120,
				reason: "Order #1001",
			});
			await controller.earnPoints({
				customerId: "cust-store-1",
				points: 80,
				reason: "Order #1002",
			});

			const balance = await controller.getLoyaltyBalance("cust-store-1");
			expect(balance.balance).toBe(200);
			expect(balance.totalEarned).toBe(200);
			expect(balance.transactionCount).toBe(2);
		});

		it("reflects redeemed points correctly", async () => {
			await controller.earnPoints({
				customerId: "cust-store-2",
				points: 300,
				reason: "Purchase",
			});
			await controller.redeemPoints({
				customerId: "cust-store-2",
				points: 100,
				reason: "10% discount",
			});

			const balance = await controller.getLoyaltyBalance("cust-store-2");
			expect(balance.balance).toBe(200);
			expect(balance.totalRedeemed).toBe(100);
			expect(balance.transactionCount).toBe(2);
		});

		it("reflects adjustments in balance", async () => {
			await controller.earnPoints({
				customerId: "cust-store-3",
				points: 500,
				reason: "Purchase",
			});
			await controller.adjustPoints({
				customerId: "cust-store-3",
				points: -50,
				reason: "Correction",
			});

			const balance = await controller.getLoyaltyBalance("cust-store-3");
			expect(balance.balance).toBe(450);
		});

		it("isolates balance between customers", async () => {
			await controller.earnPoints({
				customerId: "cust-a",
				points: 100,
				reason: "A purchase",
			});
			await controller.earnPoints({
				customerId: "cust-b",
				points: 500,
				reason: "B purchase",
			});

			const balanceA = await controller.getLoyaltyBalance("cust-a");
			const balanceB = await controller.getLoyaltyBalance("cust-b");
			expect(balanceA.balance).toBe(100);
			expect(balanceB.balance).toBe(500);
		});
	});

	describe("getLoyaltyHistory — customer self-service", () => {
		it("returns empty history for customer with no transactions", async () => {
			const result = await controller.getLoyaltyHistory("cust-empty");
			expect(result.transactions).toEqual([]);
			expect(result.total).toBe(0);
		});

		it("returns all transactions for the customer", async () => {
			await controller.earnPoints({
				customerId: "cust-hist",
				points: 100,
				reason: "First order",
			});
			await controller.earnPoints({
				customerId: "cust-hist",
				points: 200,
				reason: "Second order",
			});
			await controller.redeemPoints({
				customerId: "cust-hist",
				points: 50,
				reason: "Discount used",
			});

			const result = await controller.getLoyaltyHistory("cust-hist");
			expect(result.transactions).toHaveLength(3);
			expect(result.total).toBe(3);
			const reasons = result.transactions.map((t) => t.reason);
			expect(reasons).toContain("First order");
			expect(reasons).toContain("Second order");
			expect(reasons).toContain("Discount used");
			const types = result.transactions.map((t) => t.type);
			expect(types).toContain("earn");
			expect(types).toContain("redeem");
		});

		it("paginates with limit parameter", async () => {
			for (let i = 1; i <= 5; i++) {
				await controller.earnPoints({
					customerId: "cust-pag",
					points: i * 10,
					reason: `Order ${i}`,
				});
			}

			const page1 = await controller.getLoyaltyHistory("cust-pag", {
				limit: 2,
				offset: 0,
			});
			expect(page1.transactions).toHaveLength(2);
			expect(page1.total).toBe(5);
		});

		it("paginates with offset parameter", async () => {
			for (let i = 1; i <= 5; i++) {
				await controller.earnPoints({
					customerId: "cust-off",
					points: i * 10,
					reason: `Order ${i}`,
				});
			}

			const page2 = await controller.getLoyaltyHistory("cust-off", {
				limit: 2,
				offset: 2,
			});
			expect(page2.transactions).toHaveLength(2);
			expect(page2.total).toBe(5);
		});

		it("returns remaining items on last page", async () => {
			for (let i = 1; i <= 5; i++) {
				await controller.earnPoints({
					customerId: "cust-last",
					points: i * 10,
					reason: `Order ${i}`,
				});
			}

			const lastPage = await controller.getLoyaltyHistory("cust-last", {
				limit: 3,
				offset: 3,
			});
			expect(lastPage.transactions).toHaveLength(2);
			expect(lastPage.total).toBe(5);
		});

		it("isolates history between customers", async () => {
			await controller.earnPoints({
				customerId: "cust-iso-a",
				points: 100,
				reason: "A's order",
			});
			await controller.earnPoints({
				customerId: "cust-iso-b",
				points: 200,
				reason: "B's order",
			});

			const histA = await controller.getLoyaltyHistory("cust-iso-a");
			const histB = await controller.getLoyaltyHistory("cust-iso-b");
			expect(histA.transactions).toHaveLength(1);
			expect(histA.transactions[0].reason).toBe("A's order");
			expect(histB.transactions).toHaveLength(1);
			expect(histB.transactions[0].reason).toBe("B's order");
		});

		it("includes running balance in each transaction", async () => {
			await controller.earnPoints({
				customerId: "cust-bal",
				points: 100,
				reason: "First",
			});
			await controller.earnPoints({
				customerId: "cust-bal",
				points: 50,
				reason: "Second",
			});

			const result = await controller.getLoyaltyHistory("cust-bal");
			// Each transaction records the balance at that point
			for (const tx of result.transactions) {
				expect(typeof tx.balance).toBe("number");
				expect(tx.balance).toBeGreaterThanOrEqual(0);
			}
		});

		it("defaults to 20 items when no limit specified", async () => {
			// Create 25 transactions
			for (let i = 1; i <= 25; i++) {
				await controller.earnPoints({
					customerId: "cust-def",
					points: 10,
					reason: `Order ${i}`,
				});
			}

			const result = await controller.getLoyaltyHistory("cust-def");
			expect(result.transactions).toHaveLength(20);
			expect(result.total).toBe(25);
		});
	});
});
