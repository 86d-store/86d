import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createLoyaltyController } from "../service-impl";

/**
 * Admin workflow and edge-case tests for the loyalty module.
 *
 * Covers: account lifecycle, points earn/redeem/adjust, transaction history,
 * rules CRUD + calculation, tiers CRUD + ranking, listing, summary analytics.
 */

describe("loyalty — admin workflows", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createLoyaltyController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createLoyaltyController(mockData);
	});

	// ── Account lifecycle ──────────────────────────────────────────

	describe("account lifecycle", () => {
		it("creates account on first access", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			expect(account.id).toBeDefined();
			expect(account.customerId).toBe("cust_1");
			expect(account.balance).toBe(0);
			expect(account.status).toBe("active");
		});

		it("returns existing account on second access", async () => {
			const first = await controller.getOrCreateAccount("cust_1");
			const second = await controller.getOrCreateAccount("cust_1");
			expect(first.id).toBe(second.id);
		});

		it("getAccount returns null for unknown customer", async () => {
			const result = await controller.getAccount("nonexistent");
			expect(result).toBeNull();
		});

		it("getAccount returns existing account", async () => {
			const created = await controller.getOrCreateAccount("cust_1");
			const found = await controller.getAccount("cust_1");
			expect(found?.id).toBe(created.id);
		});

		it("suspends an active account", async () => {
			await controller.getOrCreateAccount("cust_1");
			const suspended = await controller.suspendAccount("cust_1");
			expect(suspended.status).toBe("suspended");
		});

		it("reactivates a suspended account", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.suspendAccount("cust_1");
			const reactivated = await controller.reactivateAccount("cust_1");
			expect(reactivated.status).toBe("active");
		});

		it("getAccountById works after creation", async () => {
			const created = await controller.getOrCreateAccount("cust_1");
			const found = await controller.getAccountById(created.id);
			expect(found?.customerId).toBe("cust_1");
		});

		it("getAccountById returns null for unknown id", async () => {
			const result = await controller.getAccountById("fake-id");
			expect(result).toBeNull();
		});
	});

	// ── Points: earn ──────────────────────────────────────────────

	describe("earn points", () => {
		it("adds points to account", async () => {
			await controller.getOrCreateAccount("cust_1");
			const txn = await controller.earnPoints({
				customerId: "cust_1",
				points: 500,
				description: "Purchase reward",
			});
			expect(txn.type).toBe("earn");
			expect(txn.points).toBe(500);
			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(500);
		});

		it("accumulates points across multiple earns", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "Order #1",
			});
			await controller.earnPoints({
				customerId: "cust_1",
				points: 250,
				description: "Order #2",
			});
			await controller.earnPoints({
				customerId: "cust_1",
				points: 150,
				description: "Order #3",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(500);
		});

		it("records orderId in earn transaction", async () => {
			await controller.getOrCreateAccount("cust_1");
			const txn = await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "Purchase",
				orderId: "order_42",
			});
			expect(txn.orderId).toBe("order_42");
		});
	});

	// ── Points: redeem ────────────────────────────────────────────

	describe("redeem points", () => {
		it("subtracts points from account", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.earnPoints({
				customerId: "cust_1",
				points: 1000,
				description: "Earned",
			});
			const txn = await controller.redeemPoints({
				customerId: "cust_1",
				points: 300,
				description: "Discount applied",
			});
			expect(txn.type).toBe("redeem");
			expect(txn.points).toBe(300);
			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(700);
		});

		it("records orderId in redemption", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.earnPoints({
				customerId: "cust_1",
				points: 500,
				description: "Earned",
			});
			const txn = await controller.redeemPoints({
				customerId: "cust_1",
				points: 200,
				description: "Discount",
				orderId: "order_99",
			});
			expect(txn.orderId).toBe("order_99");
		});

		it("allows full balance redemption", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.earnPoints({
				customerId: "cust_1",
				points: 500,
				description: "Earned",
			});
			await controller.redeemPoints({
				customerId: "cust_1",
				points: 500,
				description: "Full redeem",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(0);
		});
	});

	// ── Points: adjust ────────────────────────────────────────────

	describe("adjust points", () => {
		it("adjusts points up (positive)", async () => {
			await controller.getOrCreateAccount("cust_1");
			const txn = await controller.adjustPoints({
				customerId: "cust_1",
				points: 200,
				description: "Goodwill bonus",
			});
			expect(txn.type).toBe("adjust");
			expect(txn.points).toBe(200);
			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(200);
		});

		it("adjusts points down (negative)", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.earnPoints({
				customerId: "cust_1",
				points: 500,
				description: "Earned",
			});
			await controller.adjustPoints({
				customerId: "cust_1",
				points: -200,
				description: "Correction",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(300);
		});
	});

	// ── Transaction history ───────────────────────────────────────

	describe("transaction history", () => {
		it("lists all transactions for an account", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "Earn 1",
			});
			await controller.earnPoints({
				customerId: "cust_1",
				points: 200,
				description: "Earn 2",
			});
			await controller.redeemPoints({
				customerId: "cust_1",
				points: 50,
				description: "Redeem 1",
			});

			const txns = await controller.listTransactions(account.id, {});
			expect(txns).toHaveLength(3);
		});

		it("filters transactions by type", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "Earn",
			});
			await controller.redeemPoints({
				customerId: "cust_1",
				points: 50,
				description: "Redeem",
			});

			const earns = await controller.listTransactions(account.id, {
				type: "earn",
			});
			expect(earns).toHaveLength(1);
			expect(earns[0].type).toBe("earn");
		});

		it("paginates transactions", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			for (let i = 0; i < 8; i++) {
				await controller.earnPoints({
					customerId: "cust_1",
					points: 10,
					description: `Earn ${i}`,
				});
			}

			const page = await controller.listTransactions(account.id, {
				take: 3,
				skip: 2,
			});
			expect(page).toHaveLength(3);
		});

		it("returns empty for account with no transactions", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			const txns = await controller.listTransactions(account.id, {});
			expect(txns).toHaveLength(0);
		});
	});

	// ── Rules CRUD ────────────────────────────────────────────────

	describe("rules CRUD", () => {
		it("creates a per_dollar rule", async () => {
			const rule = await controller.createRule({
				name: "Base earn rate",
				type: "per_dollar",
				points: 1,
			});
			expect(rule.id).toBeDefined();
			expect(rule.name).toBe("Base earn rate");
			expect(rule.type).toBe("per_dollar");
			expect(rule.points).toBe(1);
			expect(rule.active).toBe(true);
		});

		it("creates a fixed_bonus rule with minOrderAmount", async () => {
			const rule = await controller.createRule({
				name: "Big order bonus",
				type: "fixed_bonus",
				points: 500,
				minOrderAmount: 10000,
			});
			expect(rule.type).toBe("fixed_bonus");
			expect(rule.minOrderAmount).toBe(10000);
		});

		it("creates a multiplier rule", async () => {
			const rule = await controller.createRule({
				name: "2x weekend",
				type: "multiplier",
				points: 2,
			});
			expect(rule.type).toBe("multiplier");
			expect(rule.points).toBe(2);
		});

		it("creates a signup rule", async () => {
			const rule = await controller.createRule({
				name: "Welcome bonus",
				type: "signup",
				points: 100,
			});
			expect(rule.type).toBe("signup");
			expect(rule.points).toBe(100);
		});

		it("updates a rule", async () => {
			const rule = await controller.createRule({
				name: "Original",
				type: "per_dollar",
				points: 1,
			});
			const updated = await controller.updateRule(rule.id, {
				name: "Updated",
				points: 2,
			});
			expect(updated?.name).toBe("Updated");
			expect(updated?.points).toBe(2);
		});

		it("deactivates a rule", async () => {
			const rule = await controller.createRule({
				name: "Rule",
				type: "per_dollar",
				points: 1,
			});
			const updated = await controller.updateRule(rule.id, { active: false });
			expect(updated?.active).toBe(false);
		});

		it("updateRule returns null for non-existent id", async () => {
			const result = await controller.updateRule("fake-id", { name: "X" });
			expect(result).toBeNull();
		});

		it("deletes a rule", async () => {
			const rule = await controller.createRule({
				name: "To delete",
				type: "per_dollar",
				points: 1,
			});
			const deleted = await controller.deleteRule(rule.id);
			expect(deleted).toBe(true);
		});

		it("deleteRule returns false for non-existent id", async () => {
			const result = await controller.deleteRule("fake-id");
			expect(result).toBe(false);
		});

		it("lists all rules", async () => {
			await controller.createRule({
				name: "Rule 1",
				type: "per_dollar",
				points: 1,
			});
			await controller.createRule({
				name: "Rule 2",
				type: "signup",
				points: 100,
			});
			const all = await controller.listRules();
			expect(all).toHaveLength(2);
		});

		it("lists active-only rules", async () => {
			const r1 = await controller.createRule({
				name: "Active",
				type: "per_dollar",
				points: 1,
			});
			await controller.createRule({
				name: "Also active",
				type: "signup",
				points: 50,
			});
			await controller.updateRule(r1.id, { active: false });

			const active = await controller.listRules(true);
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Also active");
		});
	});

	// ── Points calculation ────────────────────────────────────────

	describe("calculateOrderPoints", () => {
		it("returns 0 when no rules exist", async () => {
			const points = await controller.calculateOrderPoints(5000);
			expect(points).toBe(0);
		});

		it("applies per_dollar rule", async () => {
			await controller.createRule({
				name: "1pt per $1",
				type: "per_dollar",
				points: 1,
			});
			const points = await controller.calculateOrderPoints(5000);
			expect(points).toBe(5000);
		});

		it("applies fixed_bonus rule when order meets minimum", async () => {
			await controller.createRule({
				name: "Big order bonus",
				type: "fixed_bonus",
				points: 500,
				minOrderAmount: 5000,
			});
			const points = await controller.calculateOrderPoints(5000);
			expect(points).toBe(500);
		});

		it("does not apply fixed_bonus when order is below minimum", async () => {
			await controller.createRule({
				name: "Big order bonus",
				type: "fixed_bonus",
				points: 500,
				minOrderAmount: 10000,
			});
			const points = await controller.calculateOrderPoints(5000);
			expect(points).toBe(0);
		});

		it("ignores inactive rules", async () => {
			const rule = await controller.createRule({
				name: "Disabled",
				type: "per_dollar",
				points: 10,
			});
			await controller.updateRule(rule.id, { active: false });
			const points = await controller.calculateOrderPoints(5000);
			expect(points).toBe(0);
		});
	});

	// ── Tiers CRUD ────────────────────────────────────────────────

	describe("tiers CRUD", () => {
		it("creates a tier", async () => {
			const tier = await controller.createTier({
				name: "Silver",
				slug: "silver",
				minPoints: 1000,
			});
			expect(tier.id).toBeDefined();
			expect(tier.name).toBe("Silver");
			expect(tier.slug).toBe("silver");
			expect(tier.minPoints).toBe(1000);
		});

		it("creates a tier with multiplier and perks", async () => {
			const tier = await controller.createTier({
				name: "Gold",
				slug: "gold",
				minPoints: 5000,
				multiplier: 2,
				perks: { freeShipping: true, earlyAccess: true },
			});
			expect(tier.multiplier).toBe(2);
			expect(tier.perks).toEqual({ freeShipping: true, earlyAccess: true });
		});

		it("gets tier by slug", async () => {
			await controller.createTier({
				name: "Bronze",
				slug: "bronze",
				minPoints: 0,
			});
			const found = await controller.getTier("bronze");
			expect(found?.name).toBe("Bronze");
		});

		it("getTier returns null for unknown slug", async () => {
			const result = await controller.getTier("nonexistent");
			expect(result).toBeNull();
		});

		it("lists all tiers", async () => {
			await controller.createTier({
				name: "Bronze",
				slug: "bronze",
				minPoints: 0,
			});
			await controller.createTier({
				name: "Silver",
				slug: "silver",
				minPoints: 1000,
			});
			await controller.createTier({
				name: "Gold",
				slug: "gold",
				minPoints: 5000,
			});
			const tiers = await controller.listTiers();
			expect(tiers).toHaveLength(3);
		});

		it("updates a tier", async () => {
			const tier = await controller.createTier({
				name: "Silver",
				slug: "silver",
				minPoints: 1000,
			});
			const updated = await controller.updateTier(tier.id, {
				name: "Silver+",
				minPoints: 1500,
				multiplier: 1.5,
			});
			expect(updated?.name).toBe("Silver+");
			expect(updated?.minPoints).toBe(1500);
			expect(updated?.multiplier).toBe(1.5);
		});

		it("updateTier returns null for unknown id", async () => {
			const result = await controller.updateTier("fake-id", { name: "X" });
			expect(result).toBeNull();
		});

		it("deletes a tier", async () => {
			const tier = await controller.createTier({
				name: "To delete",
				slug: "temp",
				minPoints: 0,
			});
			const deleted = await controller.deleteTier(tier.id);
			expect(deleted).toBe(true);
		});

		it("deleteTier returns false for unknown id", async () => {
			const result = await controller.deleteTier("fake-id");
			expect(result).toBe(false);
		});
	});

	// ── Account listing ───────────────────────────────────────────

	describe("account listing", () => {
		it("lists all accounts", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.getOrCreateAccount("cust_2");
			await controller.getOrCreateAccount("cust_3");

			const accounts = await controller.listAccounts({});
			expect(accounts).toHaveLength(3);
		});

		it("filters by status", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.getOrCreateAccount("cust_2");
			await controller.suspendAccount("cust_1");

			const suspended = await controller.listAccounts({ status: "suspended" });
			expect(suspended).toHaveLength(1);
			expect(suspended[0].customerId).toBe("cust_1");
		});

		it("paginates accounts", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.getOrCreateAccount(`cust_${i}`);
			}
			const page = await controller.listAccounts({ take: 3, skip: 2 });
			expect(page).toHaveLength(3);
		});
	});

	// ── Summary analytics ─────────────────────────────────────────

	describe("summary analytics", () => {
		it("returns zeros on empty database", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(0);
			expect(summary.totalPointsOutstanding).toBe(0);
			expect(summary.totalLifetimeEarned).toBe(0);
		});

		it("tracks total points earned and outstanding", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.earnPoints({
				customerId: "cust_1",
				points: 1000,
				description: "Earn",
			});
			await controller.earnPoints({
				customerId: "cust_1",
				points: 500,
				description: "Earn 2",
			});
			await controller.redeemPoints({
				customerId: "cust_1",
				points: 200,
				description: "Redeem",
			});

			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(1);
			expect(summary.totalLifetimeEarned).toBe(1500);
			expect(summary.totalPointsOutstanding).toBe(1300);
		});

		it("counts multiple accounts", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.getOrCreateAccount("cust_2");
			await controller.getOrCreateAccount("cust_3");

			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(3);
		});
	});

	// ── Multi-customer isolation ──────────────────────────────────

	describe("multi-customer isolation", () => {
		it("each customer has independent points balance", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.getOrCreateAccount("cust_2");

			await controller.earnPoints({
				customerId: "cust_1",
				points: 1000,
				description: "C1 earn",
			});
			await controller.earnPoints({
				customerId: "cust_2",
				points: 300,
				description: "C2 earn",
			});

			const a1 = await controller.getAccount("cust_1");
			const a2 = await controller.getAccount("cust_2");
			expect(a1?.balance).toBe(1000);
			expect(a2?.balance).toBe(300);
		});

		it("suspending one account does not affect another", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.getOrCreateAccount("cust_2");
			await controller.suspendAccount("cust_1");

			const a1 = await controller.getAccount("cust_1");
			const a2 = await controller.getAccount("cust_2");
			expect(a1?.status).toBe("suspended");
			expect(a2?.status).toBe("active");
		});
	});
});
