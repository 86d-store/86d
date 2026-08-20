import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createBulkPricingController } from "../service-impl";

/**
 * Controller-level edge-case tests for bulk-pricing.
 * Complements service-impl.test.ts by focusing on boundary conditions,
 * multi-rule resolution ordering, scope matching nuances, date-windowed
 * scheduling, discount arithmetic, and preview/summary integrity.
 */

const makeRule = (overrides?: Record<string, unknown>) => ({
	name: "Wholesale Pricing",
	scope: "product" as const,
	targetId: "prod_1",
	...overrides,
});

const makeTier = (ruleId: string, overrides?: Record<string, unknown>) => ({
	ruleId,
	minQuantity: 10,
	discountType: "percentage" as const,
	discountValue: 10,
	...overrides,
});

describe("bulk-pricing controller edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createBulkPricingController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createBulkPricingController(mockData);
	});

	// ── Rule validation edge cases ────────────────────────────

	describe("rule validation", () => {
		it("rejects empty name (whitespace-only)", async () => {
			await expect(
				controller.createRule(makeRule({ name: "   " })),
			).rejects.toThrow("Rule name is required");
		});

		it("rejects zero-length name", async () => {
			await expect(
				controller.createRule(makeRule({ name: "" })),
			).rejects.toThrow("Rule name is required");
		});

		it("rejects an invalid scope value", async () => {
			await expect(
				controller.createRule(makeRule({ scope: "store" })),
			).rejects.toThrow("Invalid scope");
		});

		it("rejects global scope when targetId is provided", async () => {
			await expect(
				controller.createRule(
					makeRule({ scope: "global", targetId: "prod_1" }),
				),
			).rejects.toThrow("Global scope rules must not have a target ID");
		});

		it("rejects product scope without targetId", async () => {
			await expect(
				controller.createRule(
					makeRule({ scope: "product", targetId: undefined }),
				),
			).rejects.toThrow("Target ID is required for non-global scope");
		});

		it("rejects variant scope without targetId", async () => {
			await expect(
				controller.createRule(
					makeRule({ scope: "variant", targetId: undefined }),
				),
			).rejects.toThrow("Target ID is required for non-global scope");
		});

		it("rejects collection scope without targetId", async () => {
			await expect(
				controller.createRule(
					makeRule({ scope: "collection", targetId: undefined }),
				),
			).rejects.toThrow("Target ID is required for non-global scope");
		});

		it("rejects non-integer priority", async () => {
			await expect(
				controller.createRule(makeRule({ priority: 2.7 })),
			).rejects.toThrow("Priority must be an integer");
		});

		it("allows negative integer priority", async () => {
			const rule = await controller.createRule(makeRule({ priority: -5 }));
			expect(rule.priority).toBe(-5);
		});

		it("rejects startsAt equal to endsAt", async () => {
			const same = new Date("2026-06-01T00:00:00Z");
			await expect(
				controller.createRule(makeRule({ startsAt: same, endsAt: same })),
			).rejects.toThrow("Start date must be before end date");
		});

		it("rejects startsAt after endsAt", async () => {
			await expect(
				controller.createRule(
					makeRule({
						startsAt: new Date("2026-07-01"),
						endsAt: new Date("2026-06-01"),
					}),
				),
			).rejects.toThrow("Start date must be before end date");
		});
	});

	// ── Tier validation edge cases ────────────────────────────

	describe("tier validation", () => {
		it("rejects tier for a non-existent rule", async () => {
			await expect(
				controller.createTier(makeTier("no-such-rule")),
			).rejects.toThrow("Pricing rule not found");
		});

		it("rejects minQuantity of zero", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(
				controller.createTier(makeTier(rule.id, { minQuantity: 0 })),
			).rejects.toThrow("Minimum quantity must be a positive integer");
		});

		it("rejects negative minQuantity", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(
				controller.createTier(makeTier(rule.id, { minQuantity: -5 })),
			).rejects.toThrow("Minimum quantity must be a positive integer");
		});

		it("rejects fractional minQuantity", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(
				controller.createTier(makeTier(rule.id, { minQuantity: 3.5 })),
			).rejects.toThrow("Minimum quantity must be a positive integer");
		});

		it("rejects maxQuantity less than minQuantity", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(
				controller.createTier(
					makeTier(rule.id, { minQuantity: 10, maxQuantity: 5 }),
				),
			).rejects.toThrow(
				"Maximum quantity must be greater than or equal to minimum quantity",
			);
		});

		it("rejects fractional maxQuantity", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(
				controller.createTier(makeTier(rule.id, { maxQuantity: 20.5 })),
			).rejects.toThrow("Maximum quantity must be a positive integer");
		});

		it("rejects negative discountValue", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(
				controller.createTier(makeTier(rule.id, { discountValue: -1 })),
			).rejects.toThrow("Discount value must be non-negative");
		});

		it("rejects percentage discount exceeding 100", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(
				controller.createTier(
					makeTier(rule.id, {
						discountType: "percentage",
						discountValue: 100.01,
					}),
				),
			).rejects.toThrow("Percentage discount cannot exceed 100");
		});

		it("allows percentage discount of exactly 100", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(
				makeTier(rule.id, {
					discountType: "percentage",
					discountValue: 100,
				}),
			);
			expect(tier.discountValue).toBe(100);
		});

		it("allows large fixed_amount discount value", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(
				makeTier(rule.id, {
					discountType: "fixed_amount",
					discountValue: 99999,
				}),
			);
			expect(tier.discountValue).toBe(99999);
		});

		it("allows discount value of zero", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(
				makeTier(rule.id, { discountValue: 0 }),
			);
			expect(tier.discountValue).toBe(0);
		});

		it("rejects invalid discountType", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(
				controller.createTier(makeTier(rule.id, { discountType: "bogo" })),
			).rejects.toThrow("Invalid discount type");
		});
	});

	// ── All three discount types applied correctly ────────────

	describe("discount type calculations", () => {
		it("percentage: 20% off $50 = $40", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 1,
					discountType: "percentage",
					discountValue: 20,
				}),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 50,
			});
			expect(result.unitPrice).toBe(40);
			expect(result.discountPerUnit).toBe(10);
			expect(result.totalPrice).toBe(200);
			expect(result.hasDiscount).toBe(true);
		});

		it("fixed_amount: $5 off $20 = $15", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 1,
					discountType: "fixed_amount",
					discountValue: 5,
				}),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 3,
				basePrice: 20,
			});
			expect(result.unitPrice).toBe(15);
			expect(result.discountPerUnit).toBe(5);
			expect(result.totalPrice).toBe(45);
		});

		it("fixed_price: set price to $7.99 regardless of base", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 1,
					discountType: "fixed_price",
					discountValue: 7.99,
				}),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 4,
				basePrice: 25,
			});
			expect(result.unitPrice).toBe(7.99);
			expect(result.discountPerUnit).toBeCloseTo(17.01, 2);
			expect(result.totalPrice).toBeCloseTo(31.96, 2);
		});

		it("fixed_amount larger than basePrice clamps to zero", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 1,
					discountType: "fixed_amount",
					discountValue: 500,
				}),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 2,
				basePrice: 10,
			});
			expect(result.unitPrice).toBe(0);
			expect(result.totalPrice).toBe(0);
		});

		it("100% percentage discount results in zero price", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 1,
					discountType: "percentage",
					discountValue: 100,
				}),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 1,
				basePrice: 99.99,
			});
			expect(result.unitPrice).toBe(0);
			expect(result.hasDiscount).toBe(true);
		});
	});

	// ── Multi-rule priority resolution ────────────────────────

	describe("multi-rule priority resolution", () => {
		it("highest priority rule wins among matching rules", async () => {
			const lowRule = await controller.createRule(
				makeRule({ name: "Low", priority: 1 }),
			);
			await controller.createTier(
				makeTier(lowRule.id, {
					minQuantity: 1,
					discountType: "percentage",
					discountValue: 5,
				}),
			);

			const highRule = await controller.createRule(
				makeRule({ name: "High", priority: 10 }),
			);
			await controller.createTier(
				makeTier(highRule.id, {
					minQuantity: 1,
					discountType: "percentage",
					discountValue: 30,
				}),
			);

			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 100,
			});
			expect(result.unitPrice).toBe(70);
			expect(result.matchedRule?.name).toBe("High");
		});

		it("falls through to lower priority rule when higher has no matching tier", async () => {
			const highRule = await controller.createRule(
				makeRule({ name: "High-No-Tier", priority: 100 }),
			);
			// Tier requires qty >= 1000, so won't match qty=5
			await controller.createTier(
				makeTier(highRule.id, {
					minQuantity: 1000,
					discountType: "percentage",
					discountValue: 50,
				}),
			);

			const lowRule = await controller.createRule(
				makeRule({ name: "Low-Match", priority: 1 }),
			);
			await controller.createTier(
				makeTier(lowRule.id, {
					minQuantity: 1,
					discountType: "percentage",
					discountValue: 10,
				}),
			);

			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 100,
			});
			expect(result.unitPrice).toBe(90);
			expect(result.matchedRule?.name).toBe("Low-Match");
		});

		it("returns base price when no rule has a matching tier", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 100, discountValue: 20 }),
			);

			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 50,
			});
			expect(result.hasDiscount).toBe(false);
			expect(result.unitPrice).toBe(50);
			expect(result.matchedRule).toBeNull();
			expect(result.matchedTier).toBeNull();
		});
	});

	// ── Scope matching ────────────────────────────────────────

	describe("scope matching", () => {
		it("product scope matches only matching productId", async () => {
			const rule = await controller.createRule(
				makeRule({ scope: "product", targetId: "prod_A" }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 1, discountValue: 15 }),
			);

			const match = await controller.resolvePrice({
				productId: "prod_A",
				quantity: 5,
				basePrice: 100,
			});
			expect(match.hasDiscount).toBe(true);

			const noMatch = await controller.resolvePrice({
				productId: "prod_B",
				quantity: 5,
				basePrice: 100,
			});
			expect(noMatch.hasDiscount).toBe(false);
		});

		it("variant scope matches only when variantId is provided and matches", async () => {
			const rule = await controller.createRule(
				makeRule({ scope: "variant", targetId: "var_X" }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 1, discountValue: 20 }),
			);

			const match = await controller.resolvePrice({
				productId: "prod_1",
				variantId: "var_X",
				quantity: 2,
				basePrice: 100,
			});
			expect(match.hasDiscount).toBe(true);
			expect(match.unitPrice).toBe(80);

			// No variantId provided
			const noVariant = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 2,
				basePrice: 100,
			});
			expect(noVariant.hasDiscount).toBe(false);

			// Wrong variantId
			const wrongVariant = await controller.resolvePrice({
				productId: "prod_1",
				variantId: "var_Y",
				quantity: 2,
				basePrice: 100,
			});
			expect(wrongVariant.hasDiscount).toBe(false);
		});

		it("collection scope matches when targetId is in collectionIds", async () => {
			const rule = await controller.createRule(
				makeRule({ scope: "collection", targetId: "col_5" }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 1, discountValue: 12 }),
			);

			const match = await controller.resolvePrice({
				productId: "prod_1",
				collectionIds: ["col_3", "col_5", "col_9"],
				quantity: 3,
				basePrice: 100,
			});
			expect(match.hasDiscount).toBe(true);
			expect(match.unitPrice).toBe(88);

			const noMatch = await controller.resolvePrice({
				productId: "prod_1",
				collectionIds: ["col_1", "col_2"],
				quantity: 3,
				basePrice: 100,
			});
			expect(noMatch.hasDiscount).toBe(false);
		});

		it("global scope matches any product", async () => {
			const rule = await controller.createRule(
				makeRule({ name: "Global", scope: "global", targetId: undefined }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 1, discountValue: 8 }),
			);

			const r1 = await controller.resolvePrice({
				productId: "anything",
				quantity: 1,
				basePrice: 100,
			});
			expect(r1.hasDiscount).toBe(true);
			expect(r1.unitPrice).toBe(92);

			const r2 = await controller.resolvePrice({
				productId: "something_else",
				quantity: 50,
				basePrice: 200,
			});
			expect(r2.hasDiscount).toBe(true);
			expect(r2.unitPrice).toBe(184);
		});
	});

	// ── Date-windowed rules ───────────────────────────────────

	describe("date-windowed rules", () => {
		it("excludes rules that have not started yet", async () => {
			const rule = await controller.createRule(
				makeRule({ startsAt: new Date("2099-01-01") }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 1, discountValue: 50 }),
			);

			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 100,
			});
			expect(result.hasDiscount).toBe(false);
		});

		it("excludes rules that have already ended", async () => {
			const rule = await controller.createRule(
				makeRule({ endsAt: new Date("2020-01-01") }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 1, discountValue: 50 }),
			);

			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 100,
			});
			expect(result.hasDiscount).toBe(false);
		});

		it("includes rules within their active date window", async () => {
			const rule = await controller.createRule(
				makeRule({
					startsAt: new Date("2020-01-01"),
					endsAt: new Date("2099-12-31"),
				}),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 1, discountValue: 25 }),
			);

			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 100,
			});
			expect(result.hasDiscount).toBe(true);
			expect(result.unitPrice).toBe(75);
		});

		it("includes rules with no date constraints", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 1, discountValue: 10 }),
			);

			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 100,
			});
			expect(result.hasDiscount).toBe(true);
			expect(result.unitPrice).toBe(90);
		});
	});

	// ── Inactive rules ────────────────────────────────────────

	describe("inactive rules excluded from resolution", () => {
		it("skips inactive rules even if they match scope and tier", async () => {
			const rule = await controller.createRule(makeRule({ active: false }));
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 1, discountValue: 50 }),
			);

			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 10,
				basePrice: 100,
			});
			expect(result.hasDiscount).toBe(false);
			expect(result.unitPrice).toBe(100);
		});

		it("activating a previously inactive rule makes it apply", async () => {
			const rule = await controller.createRule(makeRule({ active: false }));
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 1, discountValue: 20 }),
			);

			// Inactive, no discount
			const before = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 100,
			});
			expect(before.hasDiscount).toBe(false);

			// Activate the rule
			await controller.updateRule(rule.id, { active: true });

			const after = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 100,
			});
			expect(after.hasDiscount).toBe(true);
			expect(after.unitPrice).toBe(80);
		});
	});

	// ── previewTiers ──────────────────────────────────────────

	describe("previewTiers", () => {
		it("shows correct savings percent for percentage tiers", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 5,
					discountType: "percentage",
					discountValue: 15,
				}),
			);
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 25,
					discountType: "percentage",
					discountValue: 30,
				}),
			);

			const previews = await controller.previewTiers(rule.id, 200);
			expect(previews).toHaveLength(2);
			expect(previews[0].unitPrice).toBe(170);
			expect(previews[0].savingsPercent).toBe(15);
			expect(previews[1].unitPrice).toBe(140);
			expect(previews[1].savingsPercent).toBe(30);
		});

		it("shows correct savings for fixed_amount tiers", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 10,
					discountType: "fixed_amount",
					discountValue: 4,
				}),
			);

			const previews = await controller.previewTiers(rule.id, 20);
			expect(previews[0].unitPrice).toBe(16);
			expect(previews[0].savingsPercent).toBe(20);
		});

		it("shows correct savings for fixed_price tiers", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 10,
					discountType: "fixed_price",
					discountValue: 7.5,
				}),
			);

			const previews = await controller.previewTiers(rule.id, 10);
			expect(previews[0].unitPrice).toBe(7.5);
			expect(previews[0].savingsPercent).toBe(25);
		});

		it("returns 0% savings when basePrice is zero", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 5, discountValue: 10 }),
			);

			const previews = await controller.previewTiers(rule.id, 0);
			expect(previews[0].savingsPercent).toBe(0);
			expect(previews[0].unitPrice).toBe(0);
		});

		it("orders tiers by minQuantity ascending", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 50, discountValue: 30 }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 5, discountValue: 10 }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 20, discountValue: 20 }),
			);

			const previews = await controller.previewTiers(rule.id, 100);
			expect(previews[0].tier.minQuantity).toBe(5);
			expect(previews[1].tier.minQuantity).toBe(20);
			expect(previews[2].tier.minQuantity).toBe(50);
		});

		it("throws for non-existent rule", async () => {
			await expect(controller.previewTiers("nonexistent", 100)).rejects.toThrow(
				"Pricing rule not found",
			);
		});

		it("throws for negative basePrice", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(controller.previewTiers(rule.id, -10)).rejects.toThrow(
				"Base price must be non-negative",
			);
		});
	});

	// ── resolvePrice input validation ─────────────────────────

	describe("resolvePrice input validation", () => {
		it("rejects quantity of zero", async () => {
			await expect(
				controller.resolvePrice({
					productId: "prod_1",
					quantity: 0,
					basePrice: 10,
				}),
			).rejects.toThrow("Quantity must be a positive integer");
		});

		it("rejects fractional quantity", async () => {
			await expect(
				controller.resolvePrice({
					productId: "prod_1",
					quantity: 2.5,
					basePrice: 10,
				}),
			).rejects.toThrow("Quantity must be a positive integer");
		});

		it("rejects negative quantity", async () => {
			await expect(
				controller.resolvePrice({
					productId: "prod_1",
					quantity: -1,
					basePrice: 10,
				}),
			).rejects.toThrow("Quantity must be a positive integer");
		});

		it("rejects negative basePrice", async () => {
			await expect(
				controller.resolvePrice({
					productId: "prod_1",
					quantity: 1,
					basePrice: -0.01,
				}),
			).rejects.toThrow("Base price must be non-negative");
		});

		it("allows basePrice of zero", async () => {
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 1,
				basePrice: 0,
			});
			expect(result.unitPrice).toBe(0);
			expect(result.hasDiscount).toBe(false);
		});
	});

	// ── No matching tier returns base price ───────────────────

	describe("no matching tier returns base price", () => {
		it("returns base price when quantity is below all tiers", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 100, discountValue: 25 }),
			);

			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 50,
			});
			expect(result.hasDiscount).toBe(false);
			expect(result.unitPrice).toBe(50);
			expect(result.totalPrice).toBe(250);
		});

		it("returns base price when quantity exceeds maxQuantity of all tiers", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 5,
					maxQuantity: 20,
					discountValue: 10,
				}),
			);

			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 50,
				basePrice: 100,
			});
			expect(result.hasDiscount).toBe(false);
			expect(result.unitPrice).toBe(100);
		});

		it("returns base price when there are no rules at all", async () => {
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 10,
				basePrice: 42,
			});
			expect(result.hasDiscount).toBe(false);
			expect(result.unitPrice).toBe(42);
			expect(result.totalPrice).toBe(420);
			expect(result.matchedRule).toBeNull();
			expect(result.matchedTier).toBeNull();
		});
	});

	// ── getSummary ────────────────────────────────────────────

	describe("getSummary", () => {
		it("returns all zeros when no data exists", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalRules).toBe(0);
			expect(summary.activeRules).toBe(0);
			expect(summary.totalTiers).toBe(0);
			expect(summary.rulesByScope.product).toBe(0);
			expect(summary.rulesByScope.variant).toBe(0);
			expect(summary.rulesByScope.collection).toBe(0);
			expect(summary.rulesByScope.global).toBe(0);
		});

		it("accurately counts rules, active rules, tiers, and scopes", async () => {
			const r1 = await controller.createRule(
				makeRule({ name: "Product Rule 1" }),
			);
			const r2 = await controller.createRule(
				makeRule({ name: "Product Rule 2", targetId: "prod_2" }),
			);
			await controller.createRule(
				makeRule({
					name: "Variant Rule",
					scope: "variant",
					targetId: "var_1",
				}),
			);
			await controller.createRule(
				makeRule({
					name: "Collection Rule",
					scope: "collection",
					targetId: "col_1",
					active: false,
				}),
			);
			await controller.createRule(
				makeRule({
					name: "Global Rule",
					scope: "global",
					targetId: undefined,
				}),
			);

			await controller.createTier(makeTier(r1.id, { minQuantity: 5 }));
			await controller.createTier(makeTier(r1.id, { minQuantity: 25 }));
			await controller.createTier(makeTier(r2.id, { minQuantity: 10 }));

			const summary = await controller.getSummary();
			expect(summary.totalRules).toBe(5);
			expect(summary.activeRules).toBe(4);
			expect(summary.totalTiers).toBe(3);
			expect(summary.rulesByScope.product).toBe(2);
			expect(summary.rulesByScope.variant).toBe(1);
			expect(summary.rulesByScope.collection).toBe(1);
			expect(summary.rulesByScope.global).toBe(1);
		});
	});

	// ── listRules sorting ─────────────────────────────────────

	describe("listRules sorting", () => {
		it("returns rules sorted by priority descending", async () => {
			await controller.createRule(makeRule({ name: "Low", priority: 1 }));
			await controller.createRule(makeRule({ name: "High", priority: 99 }));
			await controller.createRule(makeRule({ name: "Mid", priority: 10 }));

			const rules = await controller.listRules();
			expect(rules[0].name).toBe("High");
			expect(rules[1].name).toBe("Mid");
			expect(rules[2].name).toBe("Low");
		});
	});

	// ── Update preserves unchanged fields ─────────────────────

	describe("update preserves unchanged fields", () => {
		it("updateRule partial update keeps other fields intact", async () => {
			const rule = await controller.createRule(
				makeRule({
					name: "Original",
					description: "Keep this",
					priority: 5,
				}),
			);

			const updated = await controller.updateRule(rule.id, { priority: 20 });
			expect(updated?.name).toBe("Original");
			expect(updated?.description).toBe("Keep this");
			expect(updated?.priority).toBe(20);
			expect(updated?.scope).toBe("product");
			expect(updated?.targetId).toBe("prod_1");
		});

		it("updateTier partial update keeps other fields intact", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 10,
					maxQuantity: 50,
					discountType: "percentage",
					discountValue: 15,
					label: "Buy 10+",
				}),
			);

			const updated = await controller.updateTier(tier.id, {
				discountValue: 25,
			});
			expect(updated?.minQuantity).toBe(10);
			expect(updated?.maxQuantity).toBe(50);
			expect(updated?.discountType).toBe("percentage");
			expect(updated?.discountValue).toBe(25);
			expect(updated?.label).toBe("Buy 10+");
		});
	});

	// ── Delete idempotency ────────────────────────────────────

	describe("delete idempotency", () => {
		it("deleting a rule twice returns false the second time", async () => {
			const rule = await controller.createRule(makeRule());
			expect(await controller.deleteRule(rule.id)).toBe(true);
			expect(await controller.deleteRule(rule.id)).toBe(false);
		});

		it("deleting a tier twice returns false the second time", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(makeTier(rule.id));
			expect(await controller.deleteTier(tier.id)).toBe(true);
			expect(await controller.deleteTier(tier.id)).toBe(false);
		});
	});
});
