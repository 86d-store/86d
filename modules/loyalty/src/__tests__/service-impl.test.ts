import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createLoyaltyController } from "../service-impl";

describe("createLoyaltyController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createLoyaltyController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createLoyaltyController(mockData);
	});

	// ── Account operations ────────────────────────────────────────────

	describe("getOrCreateAccount", () => {
		it("creates a new account for a new customer", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			expect(account.id).toBeDefined();
			expect(account.customerId).toBe("cust_1");
			expect(account.balance).toBe(0);
			expect(account.tier).toBe("bronze");
			expect(account.status).toBe("active");
			expect(account.lifetimeEarned).toBe(0);
			expect(account.lifetimeRedeemed).toBe(0);
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

		it("returns null for non-existent ID", async () => {
			const found = await controller.getAccountById("missing");
			expect(found).toBeNull();
		});
	});

	describe("suspendAccount", () => {
		it("suspends an active account", async () => {
			await controller.getOrCreateAccount("cust_1");
			const suspended = await controller.suspendAccount("cust_1");
			expect(suspended.status).toBe("suspended");
		});
	});

	describe("reactivateAccount", () => {
		it("reactivates a suspended account", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.suspendAccount("cust_1");
			const reactivated = await controller.reactivateAccount("cust_1");
			expect(reactivated.status).toBe("active");
		});
	});

	// ── Points operations ─────────────────────────────────────────────

	describe("earnPoints", () => {
		it("adds points to an account", async () => {
			const txn = await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "Purchase reward",
			});
			expect(txn.type).toBe("earn");
			expect(txn.points).toBe(100);

			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(100);
			expect(account?.lifetimeEarned).toBe(100);
		});

		it("accumulates points across multiple earnings", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "First purchase",
			});
			await controller.earnPoints({
				customerId: "cust_1",
				points: 200,
				description: "Second purchase",
			});

			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(300);
			expect(account?.lifetimeEarned).toBe(300);
		});

		it("stores orderId when provided", async () => {
			const txn = await controller.earnPoints({
				customerId: "cust_1",
				points: 50,
				description: "Order reward",
				orderId: "order_123",
			});
			expect(txn.orderId).toBe("order_123");
		});

		it("replays the same accountId, orderId, and type without a second ledger row", async () => {
			const first = await controller.earnPoints({
				customerId: "cust_1",
				points: 50,
				description: "Order reward",
				orderId: "order_123",
			});
			const replay = await controller.earnPoints({
				customerId: "cust_1",
				points: 50,
				description: "Order reward retry",
				orderId: "order_123",
			});
			const account = await controller.getAccount("cust_1");
			expect(replay).toEqual(first);
			expect(account?.balance).toBe(50);
			expect(account?.lifetimeEarned).toBe(50);
		});

		it("throws on suspended account", async () => {
			await controller.suspendAccount("cust_1");
			await expect(
				controller.earnPoints({
					customerId: "cust_1",
					points: 100,
					description: "test",
				}),
			).rejects.toThrow("Cannot earn points on a non-active account");
		});
	});

	describe("redeemPoints", () => {
		it("deducts points from balance", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 500,
				description: "earn",
			});
			const txn = await controller.redeemPoints({
				customerId: "cust_1",
				points: 200,
				description: "Checkout discount",
			});

			expect(txn.type).toBe("redeem");
			expect(txn.points).toBe(200);

			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(300);
			expect(account?.lifetimeRedeemed).toBe(200);
		});

		it("throws on insufficient balance", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 50,
				description: "earn",
			});
			await expect(
				controller.redeemPoints({
					customerId: "cust_1",
					points: 100,
					description: "test",
				}),
			).rejects.toThrow("Insufficient points balance");
		});

		it("throws on suspended account", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 500,
				description: "earn",
			});
			await controller.suspendAccount("cust_1");
			await expect(
				controller.redeemPoints({
					customerId: "cust_1",
					points: 100,
					description: "test",
				}),
			).rejects.toThrow("Cannot redeem points on a non-active account");
		});
	});

	describe("adjustPoints", () => {
		it("adds points with positive adjustment", async () => {
			await controller.getOrCreateAccount("cust_1");
			const txn = await controller.adjustPoints({
				customerId: "cust_1",
				points: 50,
				description: "Bonus adjustment",
			});
			expect(txn.type).toBe("adjust");
			expect(txn.points).toBe(50);

			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(50);
		});

		it("removes points with negative adjustment", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "earn",
			});
			await controller.adjustPoints({
				customerId: "cust_1",
				points: -30,
				description: "Correction",
			});

			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(70);
		});

		it("allows balance to go negative via large negative adjustment", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 50,
				description: "earn",
			});
			await controller.adjustPoints({
				customerId: "cust_1",
				points: -100,
				description: "Admin correction",
			});

			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(-50);
		});

		it("positive adjustment increases lifetimeEarned", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.adjustPoints({
				customerId: "cust_1",
				points: 200,
				description: "Bonus",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.lifetimeEarned).toBe(200);
		});

		it("negative adjustment does not change lifetimeEarned", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 300,
				description: "earn",
			});
			await controller.adjustPoints({
				customerId: "cust_1",
				points: -100,
				description: "Correction",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.lifetimeEarned).toBe(300); // unchanged
		});
	});

	// ── Transaction history ───────────────────────────────────────────

	describe("listTransactions", () => {
		it("lists all transactions for an account", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "earn 1",
			});
			await controller.earnPoints({
				customerId: "cust_1",
				points: 200,
				description: "earn 2",
			});
			await controller.redeemPoints({
				customerId: "cust_1",
				points: 50,
				description: "redeem 1",
			});

			const txns = await controller.listTransactions(account.id);
			expect(txns).toHaveLength(3);
		});

		it("filters by transaction type", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "earn",
			});
			await controller.redeemPoints({
				customerId: "cust_1",
				points: 50,
				description: "redeem",
			});

			const earnOnly = await controller.listTransactions(account.id, {
				type: "earn",
			});
			expect(earnOnly).toHaveLength(1);
			expect(earnOnly[0].type).toBe("earn");
		});

		it("supports pagination", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			for (let i = 0; i < 5; i++) {
				await controller.earnPoints({
					customerId: "cust_1",
					points: 10,
					description: `earn ${i}`,
				});
			}
			const page = await controller.listTransactions(account.id, {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── Rules ─────────────────────────────────────────────────────────

	describe("createRule", () => {
		it("creates a new earn rule", async () => {
			const rule = await controller.createRule({
				name: "Standard Earn",
				type: "per_dollar",
				points: 1,
			});
			expect(rule.id).toBeDefined();
			expect(rule.name).toBe("Standard Earn");
			expect(rule.type).toBe("per_dollar");
			expect(rule.points).toBe(1);
			expect(rule.active).toBe(true);
		});
	});

	describe("updateRule", () => {
		it("updates rule properties", async () => {
			const rule = await controller.createRule({
				name: "Standard",
				type: "per_dollar",
				points: 1,
			});
			const updated = await controller.updateRule(rule.id, {
				points: 2,
				active: false,
			});
			expect(updated?.points).toBe(2);
			expect(updated?.active).toBe(false);
		});

		it("returns null for non-existent rule", async () => {
			const result = await controller.updateRule("missing", {
				points: 5,
			});
			expect(result).toBeNull();
		});
	});

	describe("deleteRule", () => {
		it("deletes an existing rule", async () => {
			const rule = await controller.createRule({
				name: "Test",
				type: "fixed_bonus",
				points: 50,
			});
			const deleted = await controller.deleteRule(rule.id);
			expect(deleted).toBe(true);
		});

		it("returns false for non-existent rule", async () => {
			const deleted = await controller.deleteRule("missing");
			expect(deleted).toBe(false);
		});
	});

	describe("listRules", () => {
		it("lists all rules", async () => {
			await controller.createRule({
				name: "Rule 1",
				type: "per_dollar",
				points: 1,
			});
			await controller.createRule({
				name: "Rule 2",
				type: "fixed_bonus",
				points: 50,
			});
			const rules = await controller.listRules();
			expect(rules).toHaveLength(2);
		});

		it("filters active rules only", async () => {
			const rule = await controller.createRule({
				name: "Rule 1",
				type: "per_dollar",
				points: 1,
			});
			await controller.createRule({
				name: "Rule 2",
				type: "fixed_bonus",
				points: 50,
			});
			await controller.updateRule(rule.id, { active: false });

			const activeRules = await controller.listRules(true);
			expect(activeRules).toHaveLength(1);
			expect(activeRules[0].name).toBe("Rule 2");
		});
	});

	describe("calculateOrderPoints", () => {
		it("calculates per_dollar points", async () => {
			await controller.createRule({
				name: "1 point per dollar",
				type: "per_dollar",
				points: 1,
			});
			const points = await controller.calculateOrderPoints(99.99);
			expect(points).toBe(99);
		});

		it("adds fixed bonus", async () => {
			await controller.createRule({
				name: "Bonus",
				type: "fixed_bonus",
				points: 25,
			});
			const points = await controller.calculateOrderPoints(50);
			expect(points).toBe(25);
		});

		it("combines multiple rules", async () => {
			await controller.createRule({
				name: "Per dollar",
				type: "per_dollar",
				points: 2,
			});
			await controller.createRule({
				name: "Bonus",
				type: "fixed_bonus",
				points: 10,
			});
			const points = await controller.calculateOrderPoints(50);
			expect(points).toBe(110); // 50*2 + 10
		});

		it("respects minOrderAmount", async () => {
			await controller.createRule({
				name: "Big order bonus",
				type: "fixed_bonus",
				points: 100,
				minOrderAmount: 200,
			});
			const small = await controller.calculateOrderPoints(50);
			expect(small).toBe(0);
			const big = await controller.calculateOrderPoints(250);
			expect(big).toBe(100);
		});

		it("returns 0 when no rules exist", async () => {
			const points = await controller.calculateOrderPoints(100);
			expect(points).toBe(0);
		});

		it("applies multiplier rule", async () => {
			await controller.createRule({
				name: "Base earn",
				type: "per_dollar",
				points: 1,
			});
			await controller.createRule({
				name: "Double points",
				type: "multiplier",
				points: 2,
			});
			const points = await controller.calculateOrderPoints(100);
			expect(points).toBe(200); // 100 * 1 => 100, then * 2 => 200
		});
	});

	// ── Tiers ─────────────────────────────────────────────────────────

	describe("listTiers", () => {
		it("returns empty array when no tiers configured", async () => {
			const tiers = await controller.listTiers();
			expect(tiers).toHaveLength(0);
		});

		it("returns created tiers", async () => {
			await controller.createTier({
				name: "Silver",
				slug: "silver",
				minPoints: 500,
			});
			await controller.createTier({
				name: "Gold",
				slug: "gold",
				minPoints: 2000,
			});
			const tiers = await controller.listTiers();
			expect(tiers).toHaveLength(2);
		});
	});

	describe("getTier", () => {
		it("returns tier by slug", async () => {
			await controller.createTier({
				name: "Gold",
				slug: "gold",
				minPoints: 2000,
			});
			const tier = await controller.getTier("gold");
			expect(tier?.name).toBe("Gold");
			expect(tier?.minPoints).toBe(2000);
		});

		it("returns null for non-existent slug", async () => {
			const tier = await controller.getTier("diamond");
			expect(tier).toBeNull();
		});
	});

	describe("createTier", () => {
		it("creates a tier with defaults", async () => {
			const tier = await controller.createTier({
				name: "Silver",
				slug: "silver",
				minPoints: 500,
			});
			expect(tier.multiplier).toBe(1);
			expect(tier.sortOrder).toBe(0);
		});

		it("creates with custom multiplier and perks", async () => {
			const tier = await controller.createTier({
				name: "Gold",
				slug: "gold",
				minPoints: 2000,
				multiplier: 1.5,
				perks: { freeShipping: true },
			});
			expect(tier.multiplier).toBe(1.5);
			expect(tier.perks).toEqual({ freeShipping: true });
		});
	});

	describe("updateTier", () => {
		it("updates tier properties", async () => {
			const tier = await controller.createTier({
				name: "Silver",
				slug: "silver",
				minPoints: 500,
			});
			const updated = await controller.updateTier(tier.id, {
				minPoints: 750,
				multiplier: 1.25,
			});
			expect(updated?.minPoints).toBe(750);
			expect(updated?.multiplier).toBe(1.25);
		});

		it("returns null for non-existent tier", async () => {
			const result = await controller.updateTier("missing", {
				minPoints: 100,
			});
			expect(result).toBeNull();
		});
	});

	describe("deleteTier", () => {
		it("deletes an existing tier", async () => {
			const tier = await controller.createTier({
				name: "Test",
				slug: "test",
				minPoints: 100,
			});
			const deleted = await controller.deleteTier(tier.id);
			expect(deleted).toBe(true);
			const found = await controller.getTier("test");
			expect(found).toBeNull();
		});

		it("returns false for non-existent tier", async () => {
			const deleted = await controller.deleteTier("missing");
			expect(deleted).toBe(false);
		});
	});

	// ── Tier auto-upgrade ─────────────────────────────────────────────

	describe("tier auto-calculation", () => {
		it("upgrades tier based on lifetime earned (default thresholds)", async () => {
			// With no custom tiers, uses defaults: bronze=0, silver=500, gold=2000, platinum=5000
			await controller.earnPoints({
				customerId: "cust_1",
				points: 600,
				description: "big purchase",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.tier).toBe("silver");
		});

		it("upgrades to gold tier", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 2500,
				description: "big purchase",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.tier).toBe("gold");
		});

		it("upgrades to platinum tier", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 5500,
				description: "huge purchase",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.tier).toBe("platinum");
		});

		it("stays bronze below threshold", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "small purchase",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.tier).toBe("bronze");
		});

		it("uses custom tier thresholds when configured", async () => {
			// Custom tiers with lower thresholds than defaults
			await controller.createTier({
				name: "Bronze",
				slug: "bronze",
				minPoints: 0,
			});
			await controller.createTier({
				name: "Silver",
				slug: "silver",
				minPoints: 100,
			});
			await controller.createTier({
				name: "Gold",
				slug: "gold",
				minPoints: 300,
			});

			// 150 points — default thresholds would keep bronze, custom should give silver
			await controller.earnPoints({
				customerId: "cust_1",
				points: 150,
				description: "custom tier test",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.tier).toBe("silver");
		});

		it("upgrades tier via positive adjustPoints", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.adjustPoints({
				customerId: "cust_1",
				points: 600,
				description: "Admin bonus",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.tier).toBe("silver");
			expect(account?.lifetimeEarned).toBe(600);
		});

		it("does not downgrade tier on negative adjustPoints", async () => {
			// Earn enough for silver
			await controller.earnPoints({
				customerId: "cust_1",
				points: 600,
				description: "earn",
			});
			const before = await controller.getAccount("cust_1");
			expect(before?.tier).toBe("silver");

			// Negative adjustment — no tier recalc triggered
			await controller.adjustPoints({
				customerId: "cust_1",
				points: -500,
				description: "Correction",
			});
			const after = await controller.getAccount("cust_1");
			expect(after?.tier).toBe("silver");
			expect(after?.balance).toBe(100);
		});
	});

	// ── Admin ─────────────────────────────────────────────────────────

	describe("listAccounts", () => {
		it("lists all accounts", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.getOrCreateAccount("cust_2");
			const accounts = await controller.listAccounts();
			expect(accounts).toHaveLength(2);
		});

		it("filters by tier", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.earnPoints({
				customerId: "cust_2",
				points: 600,
				description: "earn",
			});
			const silverOnly = await controller.listAccounts({
				tier: "silver",
			});
			expect(silverOnly).toHaveLength(1);
			expect(silverOnly[0].customerId).toBe("cust_2");
		});

		it("filters by status", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.getOrCreateAccount("cust_2");
			await controller.suspendAccount("cust_2");
			const suspended = await controller.listAccounts({
				status: "suspended",
			});
			expect(suspended).toHaveLength(1);
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.getOrCreateAccount(`cust_${i}`);
			}
			const page = await controller.listAccounts({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	describe("getSummary", () => {
		it("returns empty summary when no accounts", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(0);
			expect(summary.totalPointsOutstanding).toBe(0);
			expect(summary.totalLifetimeEarned).toBe(0);
			expect(summary.tierBreakdown).toHaveLength(0);
		});

		it("returns accurate summary", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "earn",
			});
			await controller.earnPoints({
				customerId: "cust_2",
				points: 200,
				description: "earn",
			});
			await controller.redeemPoints({
				customerId: "cust_1",
				points: 30,
				description: "redeem",
			});

			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(2);
			expect(summary.totalPointsOutstanding).toBe(270); // (100-30) + 200
			expect(summary.totalLifetimeEarned).toBe(300); // 100 + 200
			expect(summary.tierBreakdown).toHaveLength(1); // both bronze
			expect(summary.tierBreakdown[0].tier).toBe("bronze");
			expect(summary.tierBreakdown[0].count).toBe(2);
		});

		it("shows tier breakdown across multiple tiers", async () => {
			// 1 bronze account
			await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "small",
			});
			// 2 silver accounts
			await controller.earnPoints({
				customerId: "cust_2",
				points: 600,
				description: "medium",
			});
			await controller.earnPoints({
				customerId: "cust_3",
				points: 700,
				description: "medium",
			});
			// 1 gold account
			await controller.earnPoints({
				customerId: "cust_4",
				points: 2500,
				description: "large",
			});

			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(4);
			expect(summary.totalLifetimeEarned).toBe(100 + 600 + 700 + 2500);
			expect(summary.totalPointsOutstanding).toBe(100 + 600 + 700 + 2500);

			const breakdown = new Map(
				summary.tierBreakdown.map((b) => [b.tier, b.count]),
			);
			expect(breakdown.get("bronze")).toBe(1);
			expect(breakdown.get("silver")).toBe(2);
			expect(breakdown.get("gold")).toBe(1);
		});
	});
});
