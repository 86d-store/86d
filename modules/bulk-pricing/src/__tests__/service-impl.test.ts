import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { BulkPricingController, PricingRule } from "../service";
import { createBulkPricingController } from "../service-impl";

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

describe("createBulkPricingController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: BulkPricingController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createBulkPricingController(mockData);
	});

	// ── Rule CRUD ─────────────────────────────────────────────

	describe("createRule", () => {
		it("creates a rule with defaults", async () => {
			const rule = await controller.createRule(makeRule());
			expect(rule.id).toBeDefined();
			expect(rule.name).toBe("Wholesale Pricing");
			expect(rule.scope).toBe("product");
			expect(rule.targetId).toBe("prod_1");
			expect(rule.priority).toBe(0);
			expect(rule.active).toBe(true);
			expect(rule.createdAt).toBeInstanceOf(Date);
			expect(rule.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a rule with custom priority", async () => {
			const rule = await controller.createRule(makeRule({ priority: 5 }));
			expect(rule.priority).toBe(5);
		});

		it("creates an inactive rule", async () => {
			const rule = await controller.createRule(makeRule({ active: false }));
			expect(rule.active).toBe(false);
		});

		it("creates a rule with description", async () => {
			const rule = await controller.createRule(
				makeRule({ description: "For wholesale customers" }),
			);
			expect(rule.description).toBe("For wholesale customers");
		});

		it("trims whitespace from name", async () => {
			const rule = await controller.createRule(
				makeRule({ name: "  Trimmed  " }),
			);
			expect(rule.name).toBe("Trimmed");
		});

		it("creates a global rule without targetId", async () => {
			const rule = await controller.createRule(
				makeRule({ scope: "global", targetId: undefined }),
			);
			expect(rule.scope).toBe("global");
			expect(rule.targetId).toBeUndefined();
		});

		it("creates a variant-scoped rule", async () => {
			const rule = await controller.createRule(
				makeRule({ scope: "variant", targetId: "var_1" }),
			);
			expect(rule.scope).toBe("variant");
			expect(rule.targetId).toBe("var_1");
		});

		it("creates a collection-scoped rule", async () => {
			const rule = await controller.createRule(
				makeRule({ scope: "collection", targetId: "col_1" }),
			);
			expect(rule.scope).toBe("collection");
		});

		it("creates a rule with date range", async () => {
			const startsAt = new Date("2026-04-01");
			const endsAt = new Date("2026-04-30");
			const rule = await controller.createRule(makeRule({ startsAt, endsAt }));
			expect(rule.startsAt).toEqual(startsAt);
			expect(rule.endsAt).toEqual(endsAt);
		});

		it("rejects empty name", async () => {
			await expect(
				controller.createRule(makeRule({ name: "  " })),
			).rejects.toThrow("Rule name is required");
		});

		it("rejects non-global scope without targetId", async () => {
			await expect(
				controller.createRule(
					makeRule({ scope: "product", targetId: undefined }),
				),
			).rejects.toThrow("Target ID is required for non-global scope");
		});

		it("rejects global scope with targetId", async () => {
			await expect(
				controller.createRule(
					makeRule({ scope: "global", targetId: "prod_1" }),
				),
			).rejects.toThrow("Global scope rules must not have a target ID");
		});

		it("rejects non-integer priority", async () => {
			await expect(
				controller.createRule(makeRule({ priority: 1.5 })),
			).rejects.toThrow("Priority must be an integer");
		});

		it("rejects startsAt >= endsAt", async () => {
			const date = new Date("2026-04-15");
			await expect(
				controller.createRule(makeRule({ startsAt: date, endsAt: date })),
			).rejects.toThrow("Start date must be before end date");
		});
	});

	describe("updateRule", () => {
		it("updates rule name", async () => {
			const rule = await controller.createRule(makeRule());
			const updated = await controller.updateRule(rule.id, {
				name: "New Name",
			});
			expect(updated?.name).toBe("New Name");
		});

		it("updates multiple fields", async () => {
			const rule = await controller.createRule(makeRule());
			const updated = await controller.updateRule(rule.id, {
				name: "Updated",
				priority: 10,
				active: false,
			});
			expect(updated?.name).toBe("Updated");
			expect(updated?.priority).toBe(10);
			expect(updated?.active).toBe(false);
		});

		it("returns null for non-existent rule", async () => {
			const result = await controller.updateRule("missing", { name: "X" });
			expect(result).toBeNull();
		});

		it("rejects empty name on update", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(
				controller.updateRule(rule.id, { name: "" }),
			).rejects.toThrow("Rule name cannot be empty");
		});

		it("rejects switching to global with existing targetId", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(
				controller.updateRule(rule.id, { scope: "global" }),
			).rejects.toThrow("Global scope rules must not have a target ID");
		});

		it("clears date range with null", async () => {
			const rule = await controller.createRule(
				makeRule({
					startsAt: new Date("2026-04-01"),
					endsAt: new Date("2026-04-30"),
				}),
			);
			const updated = await controller.updateRule(rule.id, {
				startsAt: null,
				endsAt: null,
			});
			expect(updated?.startsAt).toBeUndefined();
			expect(updated?.endsAt).toBeUndefined();
		});
	});

	describe("getRule", () => {
		it("gets a rule by ID", async () => {
			const rule = await controller.createRule(makeRule());
			const found = await controller.getRule(rule.id);
			expect(found?.name).toBe("Wholesale Pricing");
		});

		it("returns null for non-existent rule", async () => {
			const result = await controller.getRule("missing");
			expect(result).toBeNull();
		});
	});

	describe("listRules", () => {
		it("lists all rules", async () => {
			await controller.createRule(makeRule());
			await controller.createRule(
				makeRule({ name: "Second", scope: "global", targetId: undefined }),
			);
			const rules = await controller.listRules();
			expect(rules).toHaveLength(2);
		});

		it("filters by scope", async () => {
			await controller.createRule(makeRule());
			await controller.createRule(
				makeRule({ name: "Global", scope: "global", targetId: undefined }),
			);
			const rules = await controller.listRules({ scope: "product" });
			expect(rules).toHaveLength(1);
			expect(rules[0].scope).toBe("product");
		});

		it("filters by active status", async () => {
			await controller.createRule(makeRule());
			await controller.createRule(
				makeRule({ name: "Inactive", active: false }),
			);
			const rules = await controller.listRules({ active: true });
			expect(rules).toHaveLength(1);
		});

		it("filters by targetId", async () => {
			await controller.createRule(makeRule());
			await controller.createRule(
				makeRule({ name: "Other", targetId: "prod_2" }),
			);
			const rules = await controller.listRules({ targetId: "prod_1" });
			expect(rules).toHaveLength(1);
		});

		it("supports pagination", async () => {
			await controller.createRule(makeRule({ name: "A" }));
			await controller.createRule(makeRule({ name: "B" }));
			await controller.createRule(makeRule({ name: "C" }));
			const page = await controller.listRules({ take: 2 });
			expect(page).toHaveLength(2);
		});
	});

	describe("deleteRule", () => {
		it("deletes an existing rule", async () => {
			const rule = await controller.createRule(makeRule());
			const deleted = await controller.deleteRule(rule.id);
			expect(deleted).toBe(true);
			const found = await controller.getRule(rule.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent rule", async () => {
			const deleted = await controller.deleteRule("missing");
			expect(deleted).toBe(false);
		});
	});

	// ── Tier CRUD ─────────────────────────────────────────────

	describe("createTier", () => {
		it("creates a tier with defaults", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(makeTier(rule.id));
			expect(tier.id).toBeDefined();
			expect(tier.ruleId).toBe(rule.id);
			expect(tier.minQuantity).toBe(10);
			expect(tier.discountType).toBe("percentage");
			expect(tier.discountValue).toBe(10);
			expect(tier.maxQuantity).toBeUndefined();
			expect(tier.label).toBeUndefined();
		});

		it("creates a tier with maxQuantity", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(
				makeTier(rule.id, { maxQuantity: 49 }),
			);
			expect(tier.maxQuantity).toBe(49);
		});

		it("creates a tier with label", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(
				makeTier(rule.id, { label: "Buy 10+, save 10%" }),
			);
			expect(tier.label).toBe("Buy 10+, save 10%");
		});

		it("creates a fixed_amount tier", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(
				makeTier(rule.id, { discountType: "fixed_amount", discountValue: 5 }),
			);
			expect(tier.discountType).toBe("fixed_amount");
			expect(tier.discountValue).toBe(5);
		});

		it("creates a fixed_price tier", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(
				makeTier(rule.id, { discountType: "fixed_price", discountValue: 8.99 }),
			);
			expect(tier.discountType).toBe("fixed_price");
			expect(tier.discountValue).toBe(8.99);
		});

		it("rejects non-existent rule", async () => {
			await expect(controller.createTier(makeTier("missing"))).rejects.toThrow(
				"Pricing rule not found",
			);
		});

		it("rejects minQuantity < 1", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(
				controller.createTier(makeTier(rule.id, { minQuantity: 0 })),
			).rejects.toThrow("Minimum quantity must be a positive integer");
		});

		it("rejects non-integer minQuantity", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(
				controller.createTier(makeTier(rule.id, { minQuantity: 1.5 })),
			).rejects.toThrow("Minimum quantity must be a positive integer");
		});

		it("rejects maxQuantity < minQuantity", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(
				controller.createTier(
					makeTier(rule.id, { minQuantity: 10, maxQuantity: 5 }),
				),
			).rejects.toThrow(
				"Maximum quantity must be greater than or equal to minimum quantity",
			);
		});

		it("rejects non-integer maxQuantity", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(
				controller.createTier(makeTier(rule.id, { maxQuantity: 10.5 })),
			).rejects.toThrow("Maximum quantity must be a positive integer");
		});

		it("rejects negative discount value", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(
				controller.createTier(makeTier(rule.id, { discountValue: -1 })),
			).rejects.toThrow("Discount value must be non-negative");
		});

		it("rejects percentage > 100", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(
				controller.createTier(makeTier(rule.id, { discountValue: 101 })),
			).rejects.toThrow("Percentage discount cannot exceed 100");
		});

		it("allows percentage = 100", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(
				makeTier(rule.id, { discountValue: 100 }),
			);
			expect(tier.discountValue).toBe(100);
		});

		it("allows maxQuantity = minQuantity", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(
				makeTier(rule.id, { minQuantity: 10, maxQuantity: 10 }),
			);
			expect(tier.maxQuantity).toBe(10);
		});
	});

	describe("updateTier", () => {
		it("updates minQuantity", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(makeTier(rule.id));
			const updated = await controller.updateTier(tier.id, {
				minQuantity: 20,
			});
			expect(updated?.minQuantity).toBe(20);
		});

		it("updates discountValue", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(makeTier(rule.id));
			const updated = await controller.updateTier(tier.id, {
				discountValue: 25,
			});
			expect(updated?.discountValue).toBe(25);
		});

		it("sets maxQuantity", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(makeTier(rule.id));
			const updated = await controller.updateTier(tier.id, {
				maxQuantity: 99,
			});
			expect(updated?.maxQuantity).toBe(99);
		});

		it("clears maxQuantity with null", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(
				makeTier(rule.id, { maxQuantity: 49 }),
			);
			const updated = await controller.updateTier(tier.id, {
				maxQuantity: null,
			});
			expect(updated?.maxQuantity).toBeUndefined();
		});

		it("clears label with null", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(
				makeTier(rule.id, { label: "Old label" }),
			);
			const updated = await controller.updateTier(tier.id, {
				label: null,
			});
			expect(updated?.label).toBeUndefined();
		});

		it("changes discount type", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(makeTier(rule.id));
			const updated = await controller.updateTier(tier.id, {
				discountType: "fixed_amount",
				discountValue: 5,
			});
			expect(updated?.discountType).toBe("fixed_amount");
			expect(updated?.discountValue).toBe(5);
		});

		it("returns null for non-existent tier", async () => {
			const result = await controller.updateTier("missing", {
				minQuantity: 5,
			});
			expect(result).toBeNull();
		});

		it("rejects minQuantity < 1 on update", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(makeTier(rule.id));
			await expect(
				controller.updateTier(tier.id, { minQuantity: 0 }),
			).rejects.toThrow("Minimum quantity must be a positive integer");
		});

		it("rejects maxQuantity < minQuantity on update", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(
				makeTier(rule.id, { minQuantity: 10 }),
			);
			await expect(
				controller.updateTier(tier.id, { maxQuantity: 5 }),
			).rejects.toThrow(
				"Maximum quantity must be greater than or equal to minimum quantity",
			);
		});

		it("rejects percentage > 100 on update", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(makeTier(rule.id));
			await expect(
				controller.updateTier(tier.id, { discountValue: 150 }),
			).rejects.toThrow("Percentage discount cannot exceed 100");
		});
	});

	describe("getTier", () => {
		it("gets a tier by ID", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(makeTier(rule.id));
			const found = await controller.getTier(tier.id);
			expect(found?.ruleId).toBe(rule.id);
		});

		it("returns null for non-existent tier", async () => {
			const result = await controller.getTier("missing");
			expect(result).toBeNull();
		});
	});

	describe("listTiers", () => {
		it("lists tiers for a rule ordered by minQuantity", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(makeTier(rule.id, { minQuantity: 50 }));
			await controller.createTier(makeTier(rule.id, { minQuantity: 10 }));
			await controller.createTier(makeTier(rule.id, { minQuantity: 25 }));
			const tiers = await controller.listTiers({ ruleId: rule.id });
			expect(tiers).toHaveLength(3);
			expect(tiers[0].minQuantity).toBe(10);
			expect(tiers[1].minQuantity).toBe(25);
			expect(tiers[2].minQuantity).toBe(50);
		});

		it("returns empty for non-existent rule", async () => {
			const tiers = await controller.listTiers({ ruleId: "missing" });
			expect(tiers).toHaveLength(0);
		});

		it("supports pagination", async () => {
			const rule = await controller.createRule(makeRule());
			for (let i = 1; i <= 5; i++) {
				await controller.createTier(makeTier(rule.id, { minQuantity: i * 10 }));
			}
			const page = await controller.listTiers({
				ruleId: rule.id,
				take: 2,
			});
			expect(page).toHaveLength(2);
		});
	});

	describe("deleteTier", () => {
		it("deletes an existing tier", async () => {
			const rule = await controller.createRule(makeRule());
			const tier = await controller.createTier(makeTier(rule.id));
			const deleted = await controller.deleteTier(tier.id);
			expect(deleted).toBe(true);
			const found = await controller.getTier(tier.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent tier", async () => {
			const deleted = await controller.deleteTier("missing");
			expect(deleted).toBe(false);
		});
	});

	// ── Price resolution ──────────────────────────────────────

	describe("resolvePrice", () => {
		it("returns no discount when no rules match", async () => {
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 10,
			});
			expect(result.hasDiscount).toBe(false);
			expect(result.unitPrice).toBe(10);
			expect(result.totalPrice).toBe(50);
			expect(result.matchedTier).toBeNull();
			expect(result.matchedRule).toBeNull();
		});

		it("applies percentage discount", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 5,
					discountType: "percentage",
					discountValue: 20,
				}),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 10,
				basePrice: 100,
			});
			expect(result.hasDiscount).toBe(true);
			expect(result.unitPrice).toBe(80);
			expect(result.discountPerUnit).toBe(20);
			expect(result.totalPrice).toBe(800);
		});

		it("applies fixed_amount discount", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 5,
					discountType: "fixed_amount",
					discountValue: 3,
				}),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 10,
				basePrice: 10,
			});
			expect(result.unitPrice).toBe(7);
			expect(result.totalPrice).toBe(70);
		});

		it("applies fixed_price discount", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 5,
					discountType: "fixed_price",
					discountValue: 6.99,
				}),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 10,
				basePrice: 10,
			});
			expect(result.unitPrice).toBe(6.99);
			expect(result.totalPrice).toBeCloseTo(69.9, 2);
		});

		it("matches the highest qualifying tier", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 5,
					maxQuantity: 19,
					discountValue: 10,
				}),
			);
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 20,
					maxQuantity: 49,
					discountValue: 20,
				}),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 50, discountValue: 30 }),
			);

			const r5 = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 100,
			});
			expect(r5.unitPrice).toBe(90);

			const r25 = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 25,
				basePrice: 100,
			});
			expect(r25.unitPrice).toBe(80);

			const r50 = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 50,
				basePrice: 100,
			});
			expect(r50.unitPrice).toBe(70);
		});

		it("does not match when quantity is below all tiers", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 10, discountValue: 15 }),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 100,
			});
			expect(result.hasDiscount).toBe(false);
		});

		it("does not match when quantity exceeds maxQuantity", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 5,
					maxQuantity: 10,
					discountValue: 15,
				}),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 15,
				basePrice: 100,
			});
			expect(result.hasDiscount).toBe(false);
		});

		it("uses higher priority rule over lower", async () => {
			await controller.createRule(
				makeRule({ name: "Low Priority", priority: 1 }),
			);
			const lowRule = (await controller.listRules({ scope: "product" })).find(
				(r) => r.name === "Low Priority",
			) as PricingRule;
			await controller.createTier(
				makeTier(lowRule.id, { minQuantity: 5, discountValue: 10 }),
			);

			await controller.createRule(
				makeRule({ name: "High Priority", priority: 10 }),
			);
			const highRule = (await controller.listRules({ scope: "product" })).find(
				(r) => r.name === "High Priority",
			) as PricingRule;
			await controller.createTier(
				makeTier(highRule.id, { minQuantity: 5, discountValue: 25 }),
			);

			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 10,
				basePrice: 100,
			});
			expect(result.unitPrice).toBe(75);
			expect(result.matchedRule?.name).toBe("High Priority");
		});

		it("matches global scope rules", async () => {
			const rule = await controller.createRule(
				makeRule({ scope: "global", targetId: undefined }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 10, discountValue: 5 }),
			);
			const result = await controller.resolvePrice({
				productId: "any_product",
				quantity: 10,
				basePrice: 100,
			});
			expect(result.hasDiscount).toBe(true);
			expect(result.unitPrice).toBe(95);
		});

		it("matches variant scope rules", async () => {
			const rule = await controller.createRule(
				makeRule({ scope: "variant", targetId: "var_1" }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 5, discountValue: 15 }),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				variantId: "var_1",
				quantity: 10,
				basePrice: 100,
			});
			expect(result.unitPrice).toBe(85);
		});

		it("does not match variant rule without variantId", async () => {
			const rule = await controller.createRule(
				makeRule({ scope: "variant", targetId: "var_1" }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 5, discountValue: 15 }),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 10,
				basePrice: 100,
			});
			expect(result.hasDiscount).toBe(false);
		});

		it("matches collection scope rules", async () => {
			const rule = await controller.createRule(
				makeRule({ scope: "collection", targetId: "col_1" }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 5, discountValue: 10 }),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				collectionIds: ["col_1", "col_2"],
				quantity: 10,
				basePrice: 100,
			});
			expect(result.hasDiscount).toBe(true);
			expect(result.unitPrice).toBe(90);
		});

		it("does not match collection rule when product not in collection", async () => {
			const rule = await controller.createRule(
				makeRule({ scope: "collection", targetId: "col_1" }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 5, discountValue: 10 }),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				collectionIds: ["col_2"],
				quantity: 10,
				basePrice: 100,
			});
			expect(result.hasDiscount).toBe(false);
		});

		it("skips inactive rules", async () => {
			const rule = await controller.createRule(makeRule({ active: false }));
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 5, discountValue: 20 }),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 10,
				basePrice: 100,
			});
			expect(result.hasDiscount).toBe(false);
		});

		it("skips rules outside date range (not yet started)", async () => {
			const rule = await controller.createRule(
				makeRule({ startsAt: new Date("2099-01-01") }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 5, discountValue: 20 }),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 10,
				basePrice: 100,
			});
			expect(result.hasDiscount).toBe(false);
		});

		it("skips rules outside date range (expired)", async () => {
			const rule = await controller.createRule(
				makeRule({ endsAt: new Date("2020-01-01") }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 5, discountValue: 20 }),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 10,
				basePrice: 100,
			});
			expect(result.hasDiscount).toBe(false);
		});

		it("unit price cannot go below zero", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 1,
					discountType: "fixed_amount",
					discountValue: 999,
				}),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 10,
			});
			expect(result.unitPrice).toBe(0);
			expect(result.totalPrice).toBe(0);
		});

		it("rejects quantity < 1", async () => {
			await expect(
				controller.resolvePrice({
					productId: "prod_1",
					quantity: 0,
					basePrice: 10,
				}),
			).rejects.toThrow("Quantity must be a positive integer");
		});

		it("rejects non-integer quantity", async () => {
			await expect(
				controller.resolvePrice({
					productId: "prod_1",
					quantity: 1.5,
					basePrice: 10,
				}),
			).rejects.toThrow("Quantity must be a positive integer");
		});

		it("rejects negative base price", async () => {
			await expect(
				controller.resolvePrice({
					productId: "prod_1",
					quantity: 1,
					basePrice: -5,
				}),
			).rejects.toThrow("Base price must be non-negative");
		});

		it("handles zero base price", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 1, discountValue: 50 }),
			);
			const result = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 10,
				basePrice: 0,
			});
			expect(result.unitPrice).toBe(0);
			expect(result.hasDiscount).toBe(false);
		});
	});

	// ── Tier preview ──────────────────────────────────────────

	describe("previewTiers", () => {
		it("previews tier pricing for a given base price", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 10, discountValue: 10 }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 25, discountValue: 20 }),
			);
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 50, discountValue: 30 }),
			);

			const previews = await controller.previewTiers(rule.id, 100);
			expect(previews).toHaveLength(3);
			expect(previews[0].unitPrice).toBe(90);
			expect(previews[0].savingsPercent).toBe(10);
			expect(previews[1].unitPrice).toBe(80);
			expect(previews[1].savingsPercent).toBe(20);
			expect(previews[2].unitPrice).toBe(70);
			expect(previews[2].savingsPercent).toBe(30);
		});

		it("handles fixed_amount tiers in preview", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 5,
					discountType: "fixed_amount",
					discountValue: 3,
				}),
			);
			const previews = await controller.previewTiers(rule.id, 10);
			expect(previews[0].unitPrice).toBe(7);
			expect(previews[0].savingsPercent).toBe(30);
		});

		it("handles fixed_price tiers in preview", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, {
					minQuantity: 5,
					discountType: "fixed_price",
					discountValue: 7.5,
				}),
			);
			const previews = await controller.previewTiers(rule.id, 10);
			expect(previews[0].unitPrice).toBe(7.5);
			expect(previews[0].savingsPercent).toBe(25);
		});

		it("returns empty for rule with no tiers", async () => {
			const rule = await controller.createRule(makeRule());
			const previews = await controller.previewTiers(rule.id, 100);
			expect(previews).toHaveLength(0);
		});

		it("rejects non-existent rule", async () => {
			await expect(controller.previewTiers("missing", 100)).rejects.toThrow(
				"Pricing rule not found",
			);
		});

		it("rejects negative base price", async () => {
			const rule = await controller.createRule(makeRule());
			await expect(controller.previewTiers(rule.id, -5)).rejects.toThrow(
				"Base price must be non-negative",
			);
		});

		it("handles zero base price with 0% savings", async () => {
			const rule = await controller.createRule(makeRule());
			await controller.createTier(
				makeTier(rule.id, { minQuantity: 5, discountValue: 10 }),
			);
			const previews = await controller.previewTiers(rule.id, 0);
			expect(previews[0].unitPrice).toBe(0);
			expect(previews[0].savingsPercent).toBe(0);
		});
	});

	// ── Analytics ─────────────────────────────────────────────

	describe("getSummary", () => {
		it("returns zeros when empty", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalRules).toBe(0);
			expect(summary.activeRules).toBe(0);
			expect(summary.totalTiers).toBe(0);
			expect(summary.rulesByScope.product).toBe(0);
			expect(summary.rulesByScope.variant).toBe(0);
			expect(summary.rulesByScope.collection).toBe(0);
			expect(summary.rulesByScope.global).toBe(0);
		});

		it("counts rules and tiers", async () => {
			const r1 = await controller.createRule(makeRule());
			await controller.createRule(
				makeRule({
					name: "Global",
					scope: "global",
					targetId: undefined,
					active: false,
				}),
			);
			await controller.createTier(makeTier(r1.id));
			await controller.createTier(
				makeTier(r1.id, { minQuantity: 25, discountValue: 20 }),
			);

			const summary = await controller.getSummary();
			expect(summary.totalRules).toBe(2);
			expect(summary.activeRules).toBe(1);
			expect(summary.totalTiers).toBe(2);
			expect(summary.rulesByScope.product).toBe(1);
			expect(summary.rulesByScope.global).toBe(1);
		});

		it("counts rules by scope", async () => {
			await controller.createRule(makeRule());
			await controller.createRule(makeRule({ name: "P2", targetId: "prod_2" }));
			await controller.createRule(
				makeRule({ name: "V1", scope: "variant", targetId: "var_1" }),
			);
			await controller.createRule(
				makeRule({
					name: "C1",
					scope: "collection",
					targetId: "col_1",
				}),
			);
			await controller.createRule(
				makeRule({
					name: "G1",
					scope: "global",
					targetId: undefined,
				}),
			);

			const summary = await controller.getSummary();
			expect(summary.rulesByScope.product).toBe(2);
			expect(summary.rulesByScope.variant).toBe(1);
			expect(summary.rulesByScope.collection).toBe(1);
			expect(summary.rulesByScope.global).toBe(1);
		});
	});
});
