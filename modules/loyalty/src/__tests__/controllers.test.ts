import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createLoyaltyController } from "../service-impl";

/**
 * Edge-case and integration tests for the loyalty controller.
 *
 * These complement the happy-path tests in service-impl.test.ts by covering
 * boundary conditions, tier threshold precision, rule combination ordering,
 * multi-customer isolation, and admin summary accuracy.
 */
describe("loyalty controller — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createLoyaltyController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createLoyaltyController(mockData);
	});

	// ── Account creation idempotency ────────────────────────────────

	describe("account creation idempotency", () => {
		it("returns the same account on repeated getOrCreateAccount calls", async () => {
			const first = await controller.getOrCreateAccount("cust_1");
			const second = await controller.getOrCreateAccount("cust_1");
			const third = await controller.getOrCreateAccount("cust_1");
			expect(first.id).toBe(second.id);
			expect(second.id).toBe(third.id);
		});

		it("preserves balance when getOrCreateAccount is called after earning", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 250,
				description: "Purchase",
			});
			const account = await controller.getOrCreateAccount("cust_1");
			expect(account.balance).toBe(250);
			expect(account.lifetimeEarned).toBe(250);
		});

		it("newly created account has correct initial values", async () => {
			const account = await controller.getOrCreateAccount("cust_new");
			expect(account.balance).toBe(0);
			expect(account.lifetimeEarned).toBe(0);
			expect(account.lifetimeRedeemed).toBe(0);
			expect(account.tier).toBe("bronze");
			expect(account.status).toBe("active");
			expect(account.createdAt).toBeInstanceOf(Date);
			expect(account.updatedAt).toBeInstanceOf(Date);
		});

		it("creates separate accounts for different customers", async () => {
			const a = await controller.getOrCreateAccount("cust_a");
			const b = await controller.getOrCreateAccount("cust_b");
			expect(a.id).not.toBe(b.id);
			expect(a.customerId).toBe("cust_a");
			expect(b.customerId).toBe("cust_b");
		});
	});

	// ── earnPoints / redeemPoints balance tracking ──────────────────

	describe("earnPoints / redeemPoints balance tracking", () => {
		it("accumulates balance across multiple earn calls", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "Order 1",
			});
			await controller.earnPoints({
				customerId: "cust_1",
				points: 250,
				description: "Order 2",
			});
			await controller.earnPoints({
				customerId: "cust_1",
				points: 150,
				description: "Order 3",
			});

			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(500);
			expect(account?.lifetimeEarned).toBe(500);
		});

		it("tracks lifetimeRedeemed correctly across multiple redeems", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 1000,
				description: "Big purchase",
			});
			await controller.redeemPoints({
				customerId: "cust_1",
				points: 200,
				description: "Redeem 1",
			});
			await controller.redeemPoints({
				customerId: "cust_1",
				points: 300,
				description: "Redeem 2",
			});

			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(500);
			expect(account?.lifetimeRedeemed).toBe(500);
			expect(account?.lifetimeEarned).toBe(1000);
		});

		it("redeem returns correct transaction type and points", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 500,
				description: "Earn",
			});
			const txn = await controller.redeemPoints({
				customerId: "cust_1",
				points: 100,
				description: "Checkout discount",
				orderId: "ord_abc",
			});
			expect(txn.type).toBe("redeem");
			expect(txn.points).toBe(100);
			expect(txn.orderId).toBe("ord_abc");
			expect(txn.description).toBe("Checkout discount");
		});

		it("earn returns correct transaction type with orderId", async () => {
			const txn = await controller.earnPoints({
				customerId: "cust_1",
				points: 75,
				description: "Purchase reward",
				orderId: "ord_xyz",
			});
			expect(txn.type).toBe("earn");
			expect(txn.points).toBe(75);
			expect(txn.orderId).toBe("ord_xyz");
		});

		it("can redeem exactly all points (balance becomes zero)", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 300,
				description: "Earn",
			});
			await controller.redeemPoints({
				customerId: "cust_1",
				points: 300,
				description: "Full redeem",
			});

			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(0);
			expect(account?.lifetimeRedeemed).toBe(300);
		});
	});

	// ── Insufficient points on redeem ───────────────────────────────

	describe("insufficient points throws on redeem", () => {
		it("throws when balance is zero", async () => {
			await controller.getOrCreateAccount("cust_1");
			await expect(
				controller.redeemPoints({
					customerId: "cust_1",
					points: 1,
					description: "Attempt",
				}),
			).rejects.toThrow("Insufficient points balance");
		});

		it("throws when redeem exceeds balance by one point", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "Earn",
			});
			await expect(
				controller.redeemPoints({
					customerId: "cust_1",
					points: 101,
					description: "Over-redeem",
				}),
			).rejects.toThrow("Insufficient points balance");
		});

		it("throws after partial redemption leaves insufficient balance", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 200,
				description: "Earn",
			});
			await controller.redeemPoints({
				customerId: "cust_1",
				points: 150,
				description: "First redeem",
			});
			await expect(
				controller.redeemPoints({
					customerId: "cust_1",
					points: 100,
					description: "Second redeem — too much",
				}),
			).rejects.toThrow("Insufficient points balance");
		});
	});

	// ── Suspended account cannot earn/redeem ────────────────────────

	describe("suspended account cannot earn/redeem", () => {
		it("throws on earnPoints for suspended account", async () => {
			await controller.suspendAccount("cust_1");
			await expect(
				controller.earnPoints({
					customerId: "cust_1",
					points: 50,
					description: "Attempt",
				}),
			).rejects.toThrow("Cannot earn points on a non-active account");
		});

		it("throws on redeemPoints for suspended account", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 500,
				description: "Pre-earn",
			});
			await controller.suspendAccount("cust_1");
			await expect(
				controller.redeemPoints({
					customerId: "cust_1",
					points: 100,
					description: "Attempt",
				}),
			).rejects.toThrow("Cannot redeem points on a non-active account");
		});

		it("can earn again after reactivation", async () => {
			await controller.suspendAccount("cust_1");
			await controller.reactivateAccount("cust_1");
			const txn = await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "After reactivation",
			});
			expect(txn.type).toBe("earn");
			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(100);
		});

		it("can redeem again after reactivation", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 500,
				description: "Pre-earn",
			});
			await controller.suspendAccount("cust_1");
			await controller.reactivateAccount("cust_1");
			const txn = await controller.redeemPoints({
				customerId: "cust_1",
				points: 200,
				description: "After reactivation",
			});
			expect(txn.type).toBe("redeem");
			expect(txn.points).toBe(200);
		});

		it("double suspend is idempotent", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.suspendAccount("cust_1");
			const result = await controller.suspendAccount("cust_1");
			expect(result.status).toBe("suspended");
		});
	});

	// ── Tier auto-upgrade thresholds ────────────────────────────────

	describe("tier auto-upgrade thresholds", () => {
		it("stays bronze below 500 lifetime earned", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 499,
				description: "Just under silver",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.tier).toBe("bronze");
		});

		it("upgrades to silver at exactly 500 lifetime earned", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 500,
				description: "Exact silver threshold",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.tier).toBe("silver");
		});

		it("stays silver below 2000 lifetime earned", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 1999,
				description: "Just under gold",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.tier).toBe("silver");
		});

		it("upgrades to gold at exactly 2000 lifetime earned", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 2000,
				description: "Exact gold threshold",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.tier).toBe("gold");
		});

		it("stays gold below 5000 lifetime earned", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 4999,
				description: "Just under platinum",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.tier).toBe("gold");
		});

		it("upgrades to platinum at exactly 5000 lifetime earned", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 5000,
				description: "Exact platinum threshold",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.tier).toBe("platinum");
		});

		it("incremental earnings eventually trigger tier upgrade", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.earnPoints({
					customerId: "cust_1",
					points: 50,
					description: `Earn ${i}`,
				});
			}
			// 10 * 50 = 500 => silver
			const account = await controller.getAccount("cust_1");
			expect(account?.tier).toBe("silver");
		});
	});

	// ── adjustPoints positive vs negative behavior ──────────────────

	describe("adjustPoints positive vs negative behavior", () => {
		it("positive adjustment adds to balance and lifetimeEarned", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.adjustPoints({
				customerId: "cust_1",
				points: 300,
				description: "Admin bonus",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(300);
			expect(account?.lifetimeEarned).toBe(300);
		});

		it("negative adjustment subtracts from balance but does not change lifetimeEarned", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 400,
				description: "Earn",
			});
			await controller.adjustPoints({
				customerId: "cust_1",
				points: -150,
				description: "Correction",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(250);
			expect(account?.lifetimeEarned).toBe(400);
		});

		it("positive adjustment triggers tier recalculation", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.adjustPoints({
				customerId: "cust_1",
				points: 600,
				description: "Admin grant — should trigger silver",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.tier).toBe("silver");
			expect(account?.lifetimeEarned).toBe(600);
		});

		it("negative adjustment does not trigger tier recalculation", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 600,
				description: "Earn enough for silver",
			});
			const before = await controller.getAccount("cust_1");
			expect(before?.tier).toBe("silver");

			await controller.adjustPoints({
				customerId: "cust_1",
				points: -500,
				description: "Big correction",
			});
			const after = await controller.getAccount("cust_1");
			// Tier stays silver since negative adjustPoints skips recalc
			expect(after?.tier).toBe("silver");
			expect(after?.balance).toBe(100);
		});

		it("adjust returns transaction with type adjust", async () => {
			await controller.getOrCreateAccount("cust_1");
			const txn = await controller.adjustPoints({
				customerId: "cust_1",
				points: -20,
				description: "Minor fix",
			});
			expect(txn.type).toBe("adjust");
			expect(txn.points).toBe(-20);
			expect(txn.description).toBe("Minor fix");
		});

		it("allows balance to go negative via large negative adjustment", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 50,
				description: "Earn",
			});
			await controller.adjustPoints({
				customerId: "cust_1",
				points: -200,
				description: "Admin override",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.balance).toBe(-150);
		});
	});

	// ── Rule types: per_dollar, fixed_bonus, multiplier ─────────────

	describe("rule types: per_dollar, fixed_bonus, multiplier", () => {
		it("per_dollar floors fractional points", async () => {
			await controller.createRule({
				name: "1 pt per dollar",
				type: "per_dollar",
				points: 1,
			});
			const points = await controller.calculateOrderPoints(99.99);
			expect(points).toBe(99); // floor(99.99 * 1)
		});

		it("per_dollar with fractional rate", async () => {
			await controller.createRule({
				name: "0.5 pt per dollar",
				type: "per_dollar",
				points: 0.5,
			});
			const points = await controller.calculateOrderPoints(75);
			expect(points).toBe(37); // floor(75 * 0.5)
		});

		it("fixed_bonus adds flat points regardless of order amount", async () => {
			await controller.createRule({
				name: "Flat bonus",
				type: "fixed_bonus",
				points: 50,
			});
			const small = await controller.calculateOrderPoints(10);
			const big = await controller.calculateOrderPoints(1000);
			expect(small).toBe(50);
			expect(big).toBe(50);
		});

		it("multiplier multiplies the running total", async () => {
			await controller.createRule({
				name: "Base",
				type: "per_dollar",
				points: 2,
			});
			await controller.createRule({
				name: "Triple multiplier",
				type: "multiplier",
				points: 3,
			});
			// order = 100 => per_dollar => 200, then multiplier => 200 * 3 = 600
			const points = await controller.calculateOrderPoints(100);
			expect(points).toBe(600);
		});

		it("multiplier with no prior points yields zero", async () => {
			await controller.createRule({
				name: "Multiplier only",
				type: "multiplier",
				points: 2,
			});
			// Running total starts at 0, floor(0 * 2) = 0
			const points = await controller.calculateOrderPoints(100);
			expect(points).toBe(0);
		});

		it("inactive rules are not applied", async () => {
			const rule = await controller.createRule({
				name: "Deactivated",
				type: "per_dollar",
				points: 10,
			});
			await controller.updateRule(rule.id, { active: false });
			const points = await controller.calculateOrderPoints(100);
			expect(points).toBe(0);
		});

		it("returns 0 when no rules exist", async () => {
			const points = await controller.calculateOrderPoints(500);
			expect(points).toBe(0);
		});
	});

	// ── calculateOrderPoints with minOrderAmount filter ─────────────

	describe("calculateOrderPoints with minOrderAmount filter", () => {
		it("skips rule when order is below minOrderAmount", async () => {
			await controller.createRule({
				name: "Big order bonus",
				type: "fixed_bonus",
				points: 100,
				minOrderAmount: 200,
			});
			const points = await controller.calculateOrderPoints(150);
			expect(points).toBe(0);
		});

		it("applies rule when order equals minOrderAmount", async () => {
			await controller.createRule({
				name: "Exact threshold bonus",
				type: "fixed_bonus",
				points: 75,
				minOrderAmount: 100,
			});
			const points = await controller.calculateOrderPoints(100);
			expect(points).toBe(75);
		});

		it("applies rule when order exceeds minOrderAmount", async () => {
			await controller.createRule({
				name: "Premium bonus",
				type: "fixed_bonus",
				points: 200,
				minOrderAmount: 50,
			});
			const points = await controller.calculateOrderPoints(500);
			expect(points).toBe(200);
		});

		it("mixed rules with different minOrderAmount thresholds", async () => {
			await controller.createRule({
				name: "Always apply",
				type: "per_dollar",
				points: 1,
			});
			await controller.createRule({
				name: "High value bonus",
				type: "fixed_bonus",
				points: 50,
				minOrderAmount: 200,
			});

			// Order $100 — only per_dollar applies
			const small = await controller.calculateOrderPoints(100);
			expect(small).toBe(100); // floor(100 * 1)

			// Order $300 — both apply
			const large = await controller.calculateOrderPoints(300);
			expect(large).toBe(350); // floor(300 * 1) + 50
		});

		it("rule with undefined minOrderAmount always applies", async () => {
			await controller.createRule({
				name: "No minimum",
				type: "fixed_bonus",
				points: 10,
			});
			const points = await controller.calculateOrderPoints(1);
			expect(points).toBe(10);
		});
	});

	// ── Custom tiers override defaults ──────────────────────────────

	describe("custom tiers override defaults", () => {
		it("uses custom tier thresholds when custom tiers are configured", async () => {
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

			// 150 points — default would be bronze (500 threshold), custom gives silver
			await controller.earnPoints({
				customerId: "cust_1",
				points: 150,
				description: "Custom tier test",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.tier).toBe("silver");
		});

		it("custom tiers with very low thresholds upgrade quickly", async () => {
			await controller.createTier({
				name: "Starter",
				slug: "bronze",
				minPoints: 0,
			});
			await controller.createTier({
				name: "VIP",
				slug: "gold",
				minPoints: 10,
			});

			await controller.earnPoints({
				customerId: "cust_1",
				points: 15,
				description: "Small earn",
			});
			const account = await controller.getAccount("cust_1");
			expect(account?.tier).toBe("gold");
		});

		it("tier with custom multiplier and perks is returned correctly", async () => {
			const tier = await controller.createTier({
				name: "Platinum Elite",
				slug: "platinum",
				minPoints: 10000,
				multiplier: 2.5,
				perks: { freeShipping: true, prioritySupport: true },
			});
			expect(tier.multiplier).toBe(2.5);
			expect(tier.perks).toEqual({
				freeShipping: true,
				prioritySupport: true,
			});
		});

		it("updateTier changes tier properties", async () => {
			const tier = await controller.createTier({
				name: "Silver",
				slug: "silver",
				minPoints: 500,
			});
			const updated = await controller.updateTier(tier.id, {
				name: "Silver Plus",
				minPoints: 400,
				multiplier: 1.5,
			});
			expect(updated?.name).toBe("Silver Plus");
			expect(updated?.minPoints).toBe(400);
			expect(updated?.multiplier).toBe(1.5);
		});

		it("deleteTier removes tier and returns true", async () => {
			const tier = await controller.createTier({
				name: "Temp",
				slug: "temp",
				minPoints: 999,
			});
			const deleted = await controller.deleteTier(tier.id);
			expect(deleted).toBe(true);
			const found = await controller.getTier("temp");
			expect(found).toBeNull();
		});

		it("deleteTier returns false for non-existent tier", async () => {
			const deleted = await controller.deleteTier("nonexistent_id");
			expect(deleted).toBe(false);
		});
	});

	// ── getSummary tier breakdown accuracy ───────────────────────────

	describe("getSummary tier breakdown accuracy", () => {
		it("returns empty summary when no accounts exist", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(0);
			expect(summary.totalPointsOutstanding).toBe(0);
			expect(summary.totalLifetimeEarned).toBe(0);
			expect(summary.tierBreakdown).toHaveLength(0);
		});

		it("single bronze account summary", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "Small purchase",
			});
			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(1);
			expect(summary.totalPointsOutstanding).toBe(100);
			expect(summary.totalLifetimeEarned).toBe(100);
			expect(summary.tierBreakdown).toHaveLength(1);
			expect(summary.tierBreakdown[0].tier).toBe("bronze");
			expect(summary.tierBreakdown[0].count).toBe(1);
		});

		it("multiple tiers in breakdown", async () => {
			// 2 bronze
			await controller.earnPoints({
				customerId: "cust_1",
				points: 50,
				description: "Small",
			});
			await controller.earnPoints({
				customerId: "cust_2",
				points: 100,
				description: "Small",
			});
			// 1 silver
			await controller.earnPoints({
				customerId: "cust_3",
				points: 800,
				description: "Medium",
			});
			// 1 gold
			await controller.earnPoints({
				customerId: "cust_4",
				points: 3000,
				description: "Large",
			});
			// 1 platinum
			await controller.earnPoints({
				customerId: "cust_5",
				points: 6000,
				description: "VIP",
			});

			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(5);
			expect(summary.totalPointsOutstanding).toBe(50 + 100 + 800 + 3000 + 6000);
			expect(summary.totalLifetimeEarned).toBe(50 + 100 + 800 + 3000 + 6000);

			const breakdown = new Map(
				summary.tierBreakdown.map((b) => [b.tier, b.count]),
			);
			expect(breakdown.get("bronze")).toBe(2);
			expect(breakdown.get("silver")).toBe(1);
			expect(breakdown.get("gold")).toBe(1);
			expect(breakdown.get("platinum")).toBe(1);
		});

		it("summary reflects redeemed points in outstanding balance", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 500,
				description: "Earn",
			});
			await controller.redeemPoints({
				customerId: "cust_1",
				points: 200,
				description: "Redeem",
			});

			const summary = await controller.getSummary();
			expect(summary.totalPointsOutstanding).toBe(300);
			expect(summary.totalLifetimeEarned).toBe(500);
		});

		it("suspended accounts are included in summary", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "Earn",
			});
			await controller.earnPoints({
				customerId: "cust_2",
				points: 200,
				description: "Earn",
			});
			await controller.suspendAccount("cust_2");

			const summary = await controller.getSummary();
			expect(summary.totalAccounts).toBe(2);
			expect(summary.totalPointsOutstanding).toBe(300);
		});
	});

	// ── Transaction history filtering ───────────────────────────────

	describe("transaction history filtering", () => {
		it("returns empty array for account with no transactions", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			const txns = await controller.listTransactions(account.id);
			expect(txns).toHaveLength(0);
		});

		it("filters earn-only transactions", async () => {
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
			await controller.adjustPoints({
				customerId: "cust_1",
				points: 10,
				description: "Adjust",
			});

			const earnOnly = await controller.listTransactions(account.id, {
				type: "earn",
			});
			expect(earnOnly).toHaveLength(1);
			expect(earnOnly[0].type).toBe("earn");
		});

		it("filters redeem-only transactions", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			await controller.earnPoints({
				customerId: "cust_1",
				points: 500,
				description: "Earn",
			});
			await controller.redeemPoints({
				customerId: "cust_1",
				points: 100,
				description: "Redeem 1",
			});
			await controller.redeemPoints({
				customerId: "cust_1",
				points: 50,
				description: "Redeem 2",
			});

			const redeemOnly = await controller.listTransactions(account.id, {
				type: "redeem",
			});
			expect(redeemOnly).toHaveLength(2);
			for (const txn of redeemOnly) {
				expect(txn.type).toBe("redeem");
			}
		});

		it("filters adjust-only transactions", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "Earn",
			});
			await controller.adjustPoints({
				customerId: "cust_1",
				points: -30,
				description: "Correction",
			});

			const adjustOnly = await controller.listTransactions(account.id, {
				type: "adjust",
			});
			expect(adjustOnly).toHaveLength(1);
			expect(adjustOnly[0].type).toBe("adjust");
			expect(adjustOnly[0].points).toBe(-30);
		});

		it("pagination with take and skip", async () => {
			const account = await controller.getOrCreateAccount("cust_1");
			for (let i = 0; i < 5; i++) {
				await controller.earnPoints({
					customerId: "cust_1",
					points: 10,
					description: `Earn ${i}`,
				});
			}

			const page = await controller.listTransactions(account.id, {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});

		it("transactions are scoped to their own account", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 100,
				description: "Cust 1",
			});
			await controller.earnPoints({
				customerId: "cust_2",
				points: 200,
				description: "Cust 2",
			});

			const account1 = await controller.getAccount("cust_1");
			const account2 = await controller.getAccount("cust_2");
			if (!account1 || !account2) throw new Error("Expected accounts");

			const txns1 = await controller.listTransactions(account1.id);
			const txns2 = await controller.listTransactions(account2.id);
			expect(txns1).toHaveLength(1);
			expect(txns2).toHaveLength(1);
			expect(txns1[0].points).toBe(100);
			expect(txns2[0].points).toBe(200);
		});
	});

	// ── listAccounts admin filtering ────────────────────────────────

	describe("listAccounts admin filtering", () => {
		it("returns empty array when no accounts exist", async () => {
			const accounts = await controller.listAccounts();
			expect(accounts).toHaveLength(0);
		});

		it("filters by tier", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 50,
				description: "Bronze",
			});
			await controller.earnPoints({
				customerId: "cust_2",
				points: 600,
				description: "Silver",
			});
			await controller.earnPoints({
				customerId: "cust_3",
				points: 700,
				description: "Silver",
			});

			const silverOnly = await controller.listAccounts({ tier: "silver" });
			expect(silverOnly).toHaveLength(2);
			for (const acct of silverOnly) {
				expect(acct.tier).toBe("silver");
			}
		});

		it("filters by status", async () => {
			await controller.getOrCreateAccount("cust_1");
			await controller.getOrCreateAccount("cust_2");
			await controller.getOrCreateAccount("cust_3");
			await controller.suspendAccount("cust_2");
			await controller.suspendAccount("cust_3");

			const suspended = await controller.listAccounts({
				status: "suspended",
			});
			expect(suspended).toHaveLength(2);

			const active = await controller.listAccounts({ status: "active" });
			expect(active).toHaveLength(1);
		});

		it("supports pagination with take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.getOrCreateAccount(`cust_${i}`);
			}
			const page = await controller.listAccounts({ take: 2, skip: 2 });
			expect(page).toHaveLength(2);
		});
	});

	// ── Rule CRUD edge cases ────────────────────────────────────────

	describe("rule CRUD edge cases", () => {
		it("createRule defaults to active=true", async () => {
			const rule = await controller.createRule({
				name: "Test Rule",
				type: "per_dollar",
				points: 1,
			});
			expect(rule.active).toBe(true);
			expect(rule.createdAt).toBeInstanceOf(Date);
		});

		it("updateRule returns null for non-existent rule", async () => {
			const result = await controller.updateRule("missing_id", {
				points: 5,
			});
			expect(result).toBeNull();
		});

		it("deleteRule returns false for non-existent rule", async () => {
			const result = await controller.deleteRule("missing_id");
			expect(result).toBe(false);
		});

		it("listRules with activeOnly filters inactive rules", async () => {
			const r1 = await controller.createRule({
				name: "Active",
				type: "per_dollar",
				points: 1,
			});
			await controller.createRule({
				name: "Also Active",
				type: "fixed_bonus",
				points: 10,
			});
			await controller.updateRule(r1.id, { active: false });

			const active = await controller.listRules(true);
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Also Active");

			const all = await controller.listRules();
			expect(all).toHaveLength(2);
		});

		it("updateRule preserves unchanged fields", async () => {
			const rule = await controller.createRule({
				name: "Original",
				type: "per_dollar",
				points: 5,
				minOrderAmount: 50,
			});
			const updated = await controller.updateRule(rule.id, {
				name: "Updated Name",
			});
			expect(updated?.name).toBe("Updated Name");
			expect(updated?.points).toBe(5);
			expect(updated?.minOrderAmount).toBe(50);
			expect(updated?.active).toBe(true);
			expect(updated?.type).toBe("per_dollar");
		});

		it("deleted rule no longer affects calculateOrderPoints", async () => {
			const rule = await controller.createRule({
				name: "Will delete",
				type: "fixed_bonus",
				points: 999,
			});
			await controller.deleteRule(rule.id);
			const points = await controller.calculateOrderPoints(100);
			expect(points).toBe(0);
		});
	});

	// ── Multi-customer isolation ────────────────────────────────────

	describe("multi-customer isolation", () => {
		it("earning points for one customer does not affect another", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 500,
				description: "Cust 1 earn",
			});
			await controller.earnPoints({
				customerId: "cust_2",
				points: 100,
				description: "Cust 2 earn",
			});

			const acct1 = await controller.getAccount("cust_1");
			const acct2 = await controller.getAccount("cust_2");
			expect(acct1?.balance).toBe(500);
			expect(acct2?.balance).toBe(100);
			expect(acct1?.tier).toBe("silver");
			expect(acct2?.tier).toBe("bronze");
		});

		it("suspending one customer does not affect another", async () => {
			await controller.earnPoints({
				customerId: "cust_1",
				points: 200,
				description: "Earn",
			});
			await controller.earnPoints({
				customerId: "cust_2",
				points: 200,
				description: "Earn",
			});
			await controller.suspendAccount("cust_1");

			// cust_2 can still earn
			await controller.earnPoints({
				customerId: "cust_2",
				points: 100,
				description: "More earn",
			});
			const acct2 = await controller.getAccount("cust_2");
			expect(acct2?.balance).toBe(300);
			expect(acct2?.status).toBe("active");

			// cust_1 cannot earn
			await expect(
				controller.earnPoints({
					customerId: "cust_1",
					points: 50,
					description: "Attempt",
				}),
			).rejects.toThrow("Cannot earn points on a non-active account");
		});
	});
});
