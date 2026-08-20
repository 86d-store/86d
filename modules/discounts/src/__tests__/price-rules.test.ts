import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createDiscountController } from "../service-impl";

describe("Cart Price Rules", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createDiscountController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createDiscountController(mockData);
	});

	describe("createPriceRule", () => {
		it("creates a percentage price rule with defaults", async () => {
			const rule = await controller.createPriceRule({
				name: "10% off orders over $50",
				type: "percentage",
				value: 10,
			});

			expect(rule.name).toBe("10% off orders over $50");
			expect(rule.type).toBe("percentage");
			expect(rule.value).toBe(10);
			expect(rule.conditions).toEqual([]);
			expect(rule.appliesTo).toBe("all");
			expect(rule.appliesToIds).toEqual([]);
			expect(rule.priority).toBe(0);
			expect(rule.stackable).toBe(false);
			expect(rule.usedCount).toBe(0);
			expect(rule.isActive).toBe(true);
			expect(rule.id).toBeDefined();
		});

		it("creates a fixed amount rule with conditions", async () => {
			const rule = await controller.createPriceRule({
				name: "$5 off when you buy 3+",
				type: "fixed_amount",
				value: 500,
				conditions: [{ type: "minimum_item_count", value: 3 }],
				priority: 1,
				stackable: true,
			});

			expect(rule.type).toBe("fixed_amount");
			expect(rule.value).toBe(500);
			expect(rule.conditions).toEqual([
				{ type: "minimum_item_count", value: 3 },
			]);
			expect(rule.priority).toBe(1);
			expect(rule.stackable).toBe(true);
		});

		it("creates a free shipping rule with date range", async () => {
			const startsAt = new Date("2026-01-01");
			const endsAt = new Date("2026-12-31");
			const rule = await controller.createPriceRule({
				name: "Free shipping all year",
				type: "free_shipping",
				value: 0,
				startsAt,
				endsAt,
			});

			expect(rule.type).toBe("free_shipping");
			expect(rule.startsAt).toEqual(startsAt);
			expect(rule.endsAt).toEqual(endsAt);
		});

		it("creates a rule with a custom id", async () => {
			const rule = await controller.createPriceRule({
				id: "custom-id",
				name: "Custom",
				type: "percentage",
				value: 5,
			});

			expect(rule.id).toBe("custom-id");
		});
	});

	describe("getPriceRule", () => {
		it("returns a price rule by id", async () => {
			const created = await controller.createPriceRule({
				name: "Test",
				type: "percentage",
				value: 10,
			});

			const fetched = await controller.getPriceRule(created.id);
			expect(fetched).toBeTruthy();
			expect(fetched?.name).toBe("Test");
		});

		it("returns null for non-existent rule", async () => {
			const fetched = await controller.getPriceRule("nonexistent");
			expect(fetched).toBeNull();
		});
	});

	describe("updatePriceRule", () => {
		it("updates rule fields", async () => {
			const rule = await controller.createPriceRule({
				name: "Old Name",
				type: "percentage",
				value: 10,
			});

			const updated = await controller.updatePriceRule(rule.id, {
				name: "New Name",
				value: 20,
				conditions: [{ type: "minimum_subtotal", value: 5000 }],
			});

			expect(updated).toBeTruthy();
			expect(updated?.name).toBe("New Name");
			expect(updated?.value).toBe(20);
			expect(updated?.conditions).toEqual([
				{ type: "minimum_subtotal", value: 5000 },
			]);
		});

		it("returns null for non-existent rule", async () => {
			const updated = await controller.updatePriceRule("nonexistent", {
				name: "X",
			});
			expect(updated).toBeNull();
		});

		it("clears optional fields when set to null", async () => {
			const rule = await controller.createPriceRule({
				name: "Test",
				type: "percentage",
				value: 10,
				maximumUses: 100,
				startsAt: new Date(),
			});

			const updated = await controller.updatePriceRule(rule.id, {
				maximumUses: null,
				startsAt: null,
			});

			expect(updated?.maximumUses).toBeUndefined();
			expect(updated?.startsAt).toBeUndefined();
		});
	});

	describe("deletePriceRule", () => {
		it("deletes a price rule", async () => {
			const rule = await controller.createPriceRule({
				name: "To Delete",
				type: "percentage",
				value: 10,
			});

			await controller.deletePriceRule(rule.id);
			const fetched = await controller.getPriceRule(rule.id);
			expect(fetched).toBeNull();
		});
	});

	describe("listPriceRules", () => {
		it("lists rules sorted by priority", async () => {
			await controller.createPriceRule({
				name: "Low Priority",
				type: "percentage",
				value: 5,
				priority: 10,
			});
			await controller.createPriceRule({
				name: "High Priority",
				type: "percentage",
				value: 20,
				priority: 1,
			});

			const { rules, total } = await controller.listPriceRules({});
			expect(total).toBe(2);
			expect(rules[0].name).toBe("High Priority");
			expect(rules[1].name).toBe("Low Priority");
		});

		it("filters by isActive", async () => {
			await controller.createPriceRule({
				name: "Active",
				type: "percentage",
				value: 10,
				isActive: true,
			});
			await controller.createPriceRule({
				name: "Inactive",
				type: "percentage",
				value: 5,
				isActive: false,
			});

			const { rules } = await controller.listPriceRules({ isActive: true });
			expect(rules).toHaveLength(1);
			expect(rules[0].name).toBe("Active");
		});

		it("paginates results", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createPriceRule({
					name: `Rule ${i}`,
					type: "percentage",
					value: i,
					priority: i,
				});
			}

			const { rules, total } = await controller.listPriceRules({
				limit: 2,
				offset: 0,
			});
			expect(total).toBe(5);
			expect(rules).toHaveLength(2);
		});
	});

	describe("evaluateCartRules", () => {
		it("returns empty when no rules exist", async () => {
			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 3,
			});
			expect(result.rules).toEqual([]);
			expect(result.totalDiscount).toBe(0);
			expect(result.freeShipping).toBe(false);
		});

		it("applies a percentage rule matching minimum_subtotal", async () => {
			await controller.createPriceRule({
				name: "10% off $50+",
				type: "percentage",
				value: 10,
				conditions: [{ type: "minimum_subtotal", value: 5000 }],
			});

			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 2,
			});

			expect(result.rules).toHaveLength(1);
			expect(result.rules[0].discountAmount).toBe(1000);
			expect(result.totalDiscount).toBe(1000);
		});

		it("skips rules that fail condition check", async () => {
			await controller.createPriceRule({
				name: "10% off $100+",
				type: "percentage",
				value: 10,
				conditions: [{ type: "minimum_subtotal", value: 10000 }],
			});

			const result = await controller.evaluateCartRules({
				subtotal: 5000,
				itemCount: 1,
			});

			expect(result.rules).toEqual([]);
		});

		it("applies minimum_item_count condition", async () => {
			await controller.createPriceRule({
				name: "Buy 3 get 15% off",
				type: "percentage",
				value: 15,
				conditions: [{ type: "minimum_item_count", value: 3 }],
			});

			const noMatch = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 2,
			});
			expect(noMatch.rules).toEqual([]);

			const match = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 3,
			});
			expect(match.rules).toHaveLength(1);
			expect(match.totalDiscount).toBe(1500);
		});

		it("applies contains_product condition", async () => {
			await controller.createPriceRule({
				name: "10% off specific product",
				type: "percentage",
				value: 10,
				conditions: [{ type: "contains_product", value: "prod-1" }],
			});

			const noMatch = await controller.evaluateCartRules({
				subtotal: 5000,
				itemCount: 1,
				productIds: ["prod-2"],
			});
			expect(noMatch.rules).toEqual([]);

			const match = await controller.evaluateCartRules({
				subtotal: 5000,
				itemCount: 1,
				productIds: ["prod-1"],
			});
			expect(match.rules).toHaveLength(1);
		});

		it("applies contains_category condition", async () => {
			await controller.createPriceRule({
				name: "Free shipping on electronics",
				type: "free_shipping",
				value: 0,
				conditions: [{ type: "contains_category", value: "cat-electronics" }],
			});

			const match = await controller.evaluateCartRules({
				subtotal: 5000,
				itemCount: 1,
				categoryIds: ["cat-electronics"],
			});

			expect(match.rules).toHaveLength(1);
			expect(match.freeShipping).toBe(true);
		});

		it("requires all conditions to match (AND logic)", async () => {
			await controller.createPriceRule({
				name: "Combo deal",
				type: "fixed_amount",
				value: 1000,
				conditions: [
					{ type: "minimum_subtotal", value: 5000 },
					{ type: "minimum_item_count", value: 2 },
				],
			});

			// Meets subtotal but not item count
			const partial = await controller.evaluateCartRules({
				subtotal: 8000,
				itemCount: 1,
			});
			expect(partial.rules).toEqual([]);

			// Meets both
			const full = await controller.evaluateCartRules({
				subtotal: 8000,
				itemCount: 2,
			});
			expect(full.rules).toHaveLength(1);
			expect(full.totalDiscount).toBe(1000);
		});

		it("skips inactive rules", async () => {
			await controller.createPriceRule({
				name: "Inactive",
				type: "percentage",
				value: 50,
				isActive: false,
			});

			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 1,
			});
			expect(result.rules).toEqual([]);
		});

		it("skips expired rules", async () => {
			await controller.createPriceRule({
				name: "Expired",
				type: "percentage",
				value: 50,
				endsAt: new Date("2020-01-01"),
			});

			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 1,
			});
			expect(result.rules).toEqual([]);
		});

		it("skips rules that have not started yet", async () => {
			await controller.createPriceRule({
				name: "Future",
				type: "percentage",
				value: 50,
				startsAt: new Date("2099-01-01"),
			});

			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 1,
			});
			expect(result.rules).toEqual([]);
		});

		it("skips rules that exceeded maximum uses", async () => {
			const rule = await controller.createPriceRule({
				name: "Limited",
				type: "percentage",
				value: 10,
				maximumUses: 5,
			});

			// Manually set usedCount to max
			await controller.updatePriceRule(rule.id, {});
			await mockData.upsert("cartPriceRule", rule.id, {
				...rule,
				usedCount: 5,
			});

			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 1,
			});
			expect(result.rules).toEqual([]);
		});

		it("applies non-stackable rule and stops", async () => {
			await controller.createPriceRule({
				name: "Big discount",
				type: "percentage",
				value: 20,
				priority: 0,
				stackable: false,
			});
			await controller.createPriceRule({
				name: "Small extra",
				type: "fixed_amount",
				value: 500,
				priority: 1,
				stackable: true,
			});

			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 1,
			});

			expect(result.rules).toHaveLength(1);
			expect(result.rules[0].ruleName).toBe("Big discount");
			expect(result.totalDiscount).toBe(2000);
		});

		it("stacks multiple stackable rules", async () => {
			await controller.createPriceRule({
				name: "10% off",
				type: "percentage",
				value: 10,
				priority: 0,
				stackable: true,
			});
			await controller.createPriceRule({
				name: "$5 off",
				type: "fixed_amount",
				value: 500,
				priority: 1,
				stackable: true,
			});

			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 1,
			});

			expect(result.rules).toHaveLength(2);
			// First: 10% of 10000 = 1000
			expect(result.rules[0].discountAmount).toBe(1000);
			// Second: $5 off remaining 9000 = 500
			expect(result.rules[1].discountAmount).toBe(500);
			expect(result.totalDiscount).toBe(1500);
		});

		it("applies free shipping rule", async () => {
			await controller.createPriceRule({
				name: "Free shipping on $50+",
				type: "free_shipping",
				value: 0,
				conditions: [{ type: "minimum_subtotal", value: 5000 }],
			});

			const result = await controller.evaluateCartRules({
				subtotal: 8000,
				itemCount: 1,
			});

			expect(result.rules).toHaveLength(1);
			expect(result.freeShipping).toBe(true);
			expect(result.totalDiscount).toBe(0);
		});

		it("caps fixed discount to remaining subtotal", async () => {
			await controller.createPriceRule({
				name: "$100 off",
				type: "fixed_amount",
				value: 10000,
			});

			const result = await controller.evaluateCartRules({
				subtotal: 3000,
				itemCount: 1,
			});

			expect(result.rules[0].discountAmount).toBe(3000);
			expect(result.totalDiscount).toBe(3000);
		});

		it("applies rules in priority order", async () => {
			await controller.createPriceRule({
				name: "Second",
				type: "fixed_amount",
				value: 200,
				priority: 5,
				stackable: true,
			});
			await controller.createPriceRule({
				name: "First",
				type: "percentage",
				value: 10,
				priority: 1,
				stackable: true,
			});

			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 1,
			});

			expect(result.rules[0].ruleName).toBe("First");
			expect(result.rules[1].ruleName).toBe("Second");
		});

		it("filters by appliesTo specific_products", async () => {
			await controller.createPriceRule({
				name: "Product specific",
				type: "percentage",
				value: 10,
				appliesTo: "specific_products",
				appliesToIds: ["prod-1", "prod-2"],
			});

			const noMatch = await controller.evaluateCartRules({
				subtotal: 5000,
				itemCount: 1,
				productIds: ["prod-99"],
			});
			expect(noMatch.rules).toEqual([]);

			const match = await controller.evaluateCartRules({
				subtotal: 5000,
				itemCount: 1,
				productIds: ["prod-1"],
			});
			expect(match.rules).toHaveLength(1);
		});
	});

	describe("applyPriceRules", () => {
		it("increments usedCount for each rule", async () => {
			const rule1 = await controller.createPriceRule({
				name: "Rule 1",
				type: "percentage",
				value: 10,
			});
			const rule2 = await controller.createPriceRule({
				name: "Rule 2",
				type: "fixed_amount",
				value: 500,
			});

			await controller.applyPriceRules([rule1.id, rule2.id]);

			const updated1 = await controller.getPriceRule(rule1.id);
			const updated2 = await controller.getPriceRule(rule2.id);
			expect(updated1?.usedCount).toBe(1);
			expect(updated2?.usedCount).toBe(1);
		});

		it("skips non-existent rule ids", async () => {
			const rule = await controller.createPriceRule({
				name: "Exists",
				type: "percentage",
				value: 10,
			});

			// Should not throw
			await controller.applyPriceRules([rule.id, "nonexistent"]);
			const updated = await controller.getPriceRule(rule.id);
			expect(updated?.usedCount).toBe(1);
		});

		it("increments multiple times on repeated calls", async () => {
			const rule = await controller.createPriceRule({
				name: "Counter",
				type: "percentage",
				value: 10,
			});

			await controller.applyPriceRules([rule.id]);
			await controller.applyPriceRules([rule.id]);
			await controller.applyPriceRules([rule.id]);

			const updated = await controller.getPriceRule(rule.id);
			expect(updated?.usedCount).toBe(3);
		});
	});
});
