import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createLoyaltyController } from "../service-impl";

/**
 * Security tests for loyalty module endpoints.
 *
 * These tests verify:
 * - Customer isolation: one customer cannot access another's points/transactions
 * - Suspended account restrictions: no earning/redeeming on suspended accounts
 * - Redemption balance enforcement: cannot redeem more than available balance
 * - Account lifecycle: suspension/reactivation state transitions
 * - Point operation validation: negative points, zero points, edge cases
 */

describe("loyalty endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createLoyaltyController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createLoyaltyController(mockData);
	});

	// ── Customer Isolation ──────────────────────────────────────────

	describe("customer isolation", () => {
		it("getAccount scopes to the correct customer", async () => {
			await controller.getOrCreateAccount("customer_a");
			await controller.getOrCreateAccount("customer_b");

			const accountA = await controller.getAccount("customer_a");
			const accountB = await controller.getAccount("customer_b");

			expect(accountA).not.toBeNull();
			expect(accountA?.customerId).toBe("customer_a");
			expect(accountB).not.toBeNull();
			expect(accountB?.customerId).toBe("customer_b");
		});

		it("earning points for one customer does not affect another", async () => {
			await controller.getOrCreateAccount("customer_a");
			await controller.getOrCreateAccount("customer_b");

			await controller.earnPoints({
				customerId: "customer_a",
				points: 500,
				description: "Order reward",
			});

			const accountA = await controller.getAccount("customer_a");
			const accountB = await controller.getAccount("customer_b");

			expect(accountA?.balance).toBe(500);
			expect(accountB?.balance).toBe(0);
		});

		it("transactions are scoped per account", async () => {
			const acctA = await controller.getOrCreateAccount("customer_a");
			const acctB = await controller.getOrCreateAccount("customer_b");

			await controller.earnPoints({
				customerId: "customer_a",
				points: 100,
				description: "Purchase",
			});
			await controller.earnPoints({
				customerId: "customer_b",
				points: 200,
				description: "Purchase",
			});

			const txA = await controller.listTransactions(acctA.id);
			const txB = await controller.listTransactions(acctB.id);

			expect(txA).toHaveLength(1);
			expect(txA[0].points).toBe(100);
			expect(txB).toHaveLength(1);
			expect(txB[0].points).toBe(200);
		});

		it("non-existent customer returns null account", async () => {
			const account = await controller.getAccount("nonexistent");
			expect(account).toBeNull();
		});
	});

	// ── Suspended Account Restrictions ─────────────────────────────

	describe("suspended account restrictions", () => {
		it("cannot earn points on a suspended account", async () => {
			await controller.getOrCreateAccount("customer_1");
			await controller.suspendAccount("customer_1");

			await expect(
				controller.earnPoints({
					customerId: "customer_1",
					points: 100,
					description: "Reward",
				}),
			).rejects.toThrow();
		});

		it("cannot redeem points on a suspended account", async () => {
			await controller.getOrCreateAccount("customer_1");
			await controller.earnPoints({
				customerId: "customer_1",
				points: 500,
				description: "Initial balance",
			});
			await controller.suspendAccount("customer_1");

			await expect(
				controller.redeemPoints({
					customerId: "customer_1",
					points: 100,
					description: "Redeem",
				}),
			).rejects.toThrow();
		});

		it("reactivated account can earn and redeem again", async () => {
			await controller.getOrCreateAccount("customer_1");
			await controller.earnPoints({
				customerId: "customer_1",
				points: 500,
				description: "Initial balance",
			});
			await controller.suspendAccount("customer_1");
			await controller.reactivateAccount("customer_1");

			const earned = await controller.earnPoints({
				customerId: "customer_1",
				points: 100,
				description: "Post-reactivation",
			});
			expect(earned).not.toBeNull();

			const redeemed = await controller.redeemPoints({
				customerId: "customer_1",
				points: 50,
				description: "Redeem after reactivation",
			});
			expect(redeemed).not.toBeNull();
		});

		it("suspension of one account does not affect others", async () => {
			await controller.getOrCreateAccount("customer_a");
			await controller.getOrCreateAccount("customer_b");
			await controller.suspendAccount("customer_a");

			// customer_b should still be able to earn
			const earned = await controller.earnPoints({
				customerId: "customer_b",
				points: 100,
				description: "Normal earn",
			});
			expect(earned).not.toBeNull();
		});
	});

	// ── Redemption Balance Enforcement ──────────────────────────────

	describe("redemption balance enforcement", () => {
		it("cannot redeem more points than available balance", async () => {
			await controller.getOrCreateAccount("customer_1");
			await controller.earnPoints({
				customerId: "customer_1",
				points: 100,
				description: "Earn",
			});

			await expect(
				controller.redeemPoints({
					customerId: "customer_1",
					points: 200,
					description: "Over-redeem",
				}),
			).rejects.toThrow();
		});

		it("exact balance redemption succeeds", async () => {
			await controller.getOrCreateAccount("customer_1");
			await controller.earnPoints({
				customerId: "customer_1",
				points: 100,
				description: "Earn",
			});

			const tx = await controller.redeemPoints({
				customerId: "customer_1",
				points: 100,
				description: "Redeem all",
			});
			expect(tx).not.toBeNull();

			const account = await controller.getAccount("customer_1");
			expect(account?.balance).toBe(0);
		});

		it("multiple partial redemptions enforce cumulative balance", async () => {
			await controller.getOrCreateAccount("customer_1");
			await controller.earnPoints({
				customerId: "customer_1",
				points: 300,
				description: "Earn",
			});

			await controller.redeemPoints({
				customerId: "customer_1",
				points: 100,
				description: "First redeem",
			});
			await controller.redeemPoints({
				customerId: "customer_1",
				points: 100,
				description: "Second redeem",
			});

			// Third should fail — only 100 left
			await expect(
				controller.redeemPoints({
					customerId: "customer_1",
					points: 200,
					description: "Over-redeem",
				}),
			).rejects.toThrow();

			// Exact remaining should work
			const tx = await controller.redeemPoints({
				customerId: "customer_1",
				points: 100,
				description: "Exact remaining",
			});
			expect(tx).not.toBeNull();
		});
	});

	// ── Tier Security ───────────────────────────────────────────────

	describe("tier security", () => {
		it("multiple tiers can coexist", async () => {
			await controller.createTier({
				name: "Gold",
				slug: "gold",
				minPoints: 1000,
			});
			await controller.createTier({
				name: "Platinum",
				slug: "platinum",
				minPoints: 5000,
			});

			const gold = await controller.getTier("gold");
			const platinum = await controller.getTier("platinum");
			expect(gold).not.toBeNull();
			expect(platinum).not.toBeNull();
			expect(gold?.minPoints).toBe(1000);
			expect(platinum?.minPoints).toBe(5000);
		});

		it("deleted tier returns null", async () => {
			const tier = await controller.createTier({
				name: "Silver",
				slug: "silver",
				minPoints: 500,
			});

			await controller.deleteTier(tier.id);
			const result = await controller.getTier("silver");
			expect(result).toBeNull();
		});
	});

	// ── Rule Security ───────────────────────────────────────────────

	describe("rule security", () => {
		it("inactive rules do not affect point calculations", async () => {
			const rule = await controller.createRule({
				name: "Order Bonus",
				type: "fixed_bonus",
				points: 100,
				minOrderAmount: 50,
			});

			await controller.updateRule(rule.id, { active: false });

			const points = await controller.calculateOrderPoints(100);
			// With no active rules, should return 0
			expect(points).toBe(0);
		});

		it("only active rules contribute to point calculations", async () => {
			await controller.createRule({
				name: "Active Rule",
				type: "fixed_bonus",
				points: 50,
				minOrderAmount: 10,
			});
			const inactive = await controller.createRule({
				name: "Inactive Rule",
				type: "fixed_bonus",
				points: 1000,
				minOrderAmount: 10,
			});
			await controller.updateRule(inactive.id, { active: false });

			const points = await controller.calculateOrderPoints(100);
			expect(points).toBe(50);
		});

		it("deleted rule no longer affects calculations", async () => {
			const rule = await controller.createRule({
				name: "Temporary Rule",
				type: "fixed_bonus",
				points: 100,
				minOrderAmount: 0,
			});

			const beforeDelete = await controller.calculateOrderPoints(50);
			expect(beforeDelete).toBe(100);

			await controller.deleteRule(rule.id);

			const afterDelete = await controller.calculateOrderPoints(50);
			expect(afterDelete).toBe(0);
		});
	});

	// ── Account Lifecycle ───────────────────────────────────────────

	describe("account lifecycle", () => {
		it("getOrCreateAccount is idempotent", async () => {
			const first = await controller.getOrCreateAccount("customer_1");
			const second = await controller.getOrCreateAccount("customer_1");

			expect(first.id).toBe(second.id);
			expect(first.customerId).toBe(second.customerId);
		});

		it("balance persists across getOrCreateAccount calls", async () => {
			await controller.getOrCreateAccount("customer_1");
			await controller.earnPoints({
				customerId: "customer_1",
				points: 500,
				description: "Earn",
			});

			const account = await controller.getOrCreateAccount("customer_1");
			expect(account.balance).toBe(500);
		});

		it("adjust points works with negative values", async () => {
			await controller.getOrCreateAccount("customer_1");
			await controller.earnPoints({
				customerId: "customer_1",
				points: 500,
				description: "Earn",
			});

			await controller.adjustPoints({
				customerId: "customer_1",
				points: -200,
				description: "Admin correction",
			});

			const account = await controller.getAccount("customer_1");
			expect(account?.balance).toBe(300);
		});
	});
});
