import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createBulkPricingController } from "../service-impl";

/**
 * Security regression tests for bulk-pricing endpoints.
 *
 * Bulk pricing has a public store endpoint (resolvePrice) and admin CRUD.
 * Security focuses on:
 * - Inactive rules are never applied to storefront pricing
 * - Expired/future-scheduled rules are excluded from resolution
 * - Discount validation prevents negative prices or >100% percentage
 * - Scope + targetId constraints enforce valid rule configuration
 * - Tier quantity boundaries are strictly enforced
 * - Price resolution uses highest-priority matching rule
 */

describe("bulk-pricing endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createBulkPricingController>;

	const past = new Date(Date.now() - 3600_000);
	const future = new Date(Date.now() + 3600_000);

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createBulkPricingController(mockData);
	});

	describe("rule visibility in price resolution", () => {
		it("inactive rules are never applied", async () => {
			const rule = await controller.createRule({
				name: "Inactive Rule",
				scope: "global",
				active: false,
			});
			await controller.createTier({
				ruleId: rule.id,
				minQuantity: 1,
				discountType: "percentage",
				discountValue: 50,
			});

			const resolved = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 10,
				basePrice: 1000,
			});

			expect(resolved.hasDiscount).toBe(false);
			expect(resolved.unitPrice).toBe(1000);
		});

		it("future-scheduled rules are not applied", async () => {
			const rule = await controller.createRule({
				name: "Future Rule",
				scope: "global",
				startsAt: future,
			});
			await controller.createTier({
				ruleId: rule.id,
				minQuantity: 1,
				discountType: "percentage",
				discountValue: 50,
			});

			const resolved = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 10,
				basePrice: 1000,
			});

			expect(resolved.hasDiscount).toBe(false);
		});

		it("expired rules are not applied", async () => {
			const rule = await controller.createRule({
				name: "Expired Rule",
				scope: "global",
				startsAt: new Date(Date.now() - 7200_000),
				endsAt: past,
			});
			await controller.createTier({
				ruleId: rule.id,
				minQuantity: 1,
				discountType: "percentage",
				discountValue: 50,
			});

			const resolved = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 10,
				basePrice: 1000,
			});

			expect(resolved.hasDiscount).toBe(false);
		});

		it("active + in-schedule rule is applied", async () => {
			const rule = await controller.createRule({
				name: "Active Rule",
				scope: "global",
				startsAt: past,
				endsAt: future,
			});
			await controller.createTier({
				ruleId: rule.id,
				minQuantity: 5,
				discountType: "percentage",
				discountValue: 10,
			});

			const resolved = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 10,
				basePrice: 1000,
			});

			expect(resolved.hasDiscount).toBe(true);
			expect(resolved.unitPrice).toBe(900);
		});
	});

	describe("scope targeting enforcement", () => {
		it("product-scoped rule only applies to targeted product", async () => {
			const rule = await controller.createRule({
				name: "Product Rule",
				scope: "product",
				targetId: "prod_1",
			});
			await controller.createTier({
				ruleId: rule.id,
				minQuantity: 1,
				discountType: "percentage",
				discountValue: 20,
			});

			const targeted = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 1000,
			});
			expect(targeted.hasDiscount).toBe(true);

			const other = await controller.resolvePrice({
				productId: "prod_2",
				quantity: 5,
				basePrice: 1000,
			});
			expect(other.hasDiscount).toBe(false);
		});

		it("variant-scoped rule only applies to targeted variant", async () => {
			const rule = await controller.createRule({
				name: "Variant Rule",
				scope: "variant",
				targetId: "var_1",
			});
			await controller.createTier({
				ruleId: rule.id,
				minQuantity: 1,
				discountType: "percentage",
				discountValue: 15,
			});

			const targeted = await controller.resolvePrice({
				productId: "prod_1",
				variantId: "var_1",
				quantity: 5,
				basePrice: 1000,
			});
			expect(targeted.hasDiscount).toBe(true);

			const other = await controller.resolvePrice({
				productId: "prod_1",
				variantId: "var_2",
				quantity: 5,
				basePrice: 1000,
			});
			expect(other.hasDiscount).toBe(false);
		});

		it("collection-scoped rule only applies to products in that collection", async () => {
			const rule = await controller.createRule({
				name: "Collection Rule",
				scope: "collection",
				targetId: "col_1",
			});
			await controller.createTier({
				ruleId: rule.id,
				minQuantity: 1,
				discountType: "percentage",
				discountValue: 10,
			});

			const inCollection = await controller.resolvePrice({
				productId: "prod_1",
				collectionIds: ["col_1", "col_2"],
				quantity: 5,
				basePrice: 1000,
			});
			expect(inCollection.hasDiscount).toBe(true);

			const notInCollection = await controller.resolvePrice({
				productId: "prod_1",
				collectionIds: ["col_3"],
				quantity: 5,
				basePrice: 1000,
			});
			expect(notInCollection.hasDiscount).toBe(false);
		});
	});

	describe("discount validation", () => {
		it("rejects percentage discount > 100", async () => {
			const rule = await controller.createRule({
				name: "Test",
				scope: "global",
			});
			await expect(
				controller.createTier({
					ruleId: rule.id,
					minQuantity: 1,
					discountType: "percentage",
					discountValue: 101,
				}),
			).rejects.toThrow("Percentage discount cannot exceed 100");
		});

		it("rejects negative discount values", async () => {
			const rule = await controller.createRule({
				name: "Test",
				scope: "global",
			});
			await expect(
				controller.createTier({
					ruleId: rule.id,
					minQuantity: 1,
					discountType: "percentage",
					discountValue: -5,
				}),
			).rejects.toThrow("Discount value must be non-negative");
		});

		it("fixed_amount discount never results in negative price", async () => {
			const rule = await controller.createRule({
				name: "Big Discount",
				scope: "global",
			});
			await controller.createTier({
				ruleId: rule.id,
				minQuantity: 1,
				discountType: "fixed_amount",
				discountValue: 5000, // More than base price
			});

			const resolved = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 1,
				basePrice: 1000,
			});

			expect(resolved.unitPrice).toBe(0); // Clamped to 0, never negative
		});
	});

	describe("rule creation validation", () => {
		it("rejects empty rule name", async () => {
			await expect(
				controller.createRule({ name: "  ", scope: "global" }),
			).rejects.toThrow("Rule name is required");
		});

		it("rejects non-global scope without targetId", async () => {
			await expect(
				controller.createRule({ name: "Test", scope: "product" }),
			).rejects.toThrow("Target ID is required for non-global scope");
		});

		it("rejects global scope with targetId", async () => {
			await expect(
				controller.createRule({
					name: "Test",
					scope: "global",
					targetId: "some-id",
				}),
			).rejects.toThrow("Global scope rules must not have a target ID");
		});

		it("rejects startsAt >= endsAt", async () => {
			await expect(
				controller.createRule({
					name: "Test",
					scope: "global",
					startsAt: future,
					endsAt: past,
				}),
			).rejects.toThrow("Start date must be before end date");
		});
	});

	describe("tier quantity boundary enforcement", () => {
		it("quantity below minQuantity does not match tier", async () => {
			const rule = await controller.createRule({
				name: "Bulk Only",
				scope: "global",
			});
			await controller.createTier({
				ruleId: rule.id,
				minQuantity: 10,
				discountType: "percentage",
				discountValue: 20,
			});

			const resolved = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 1000,
			});

			expect(resolved.hasDiscount).toBe(false);
		});

		it("quantity above maxQuantity does not match tier", async () => {
			const rule = await controller.createRule({
				name: "Limited Tier",
				scope: "global",
			});
			await controller.createTier({
				ruleId: rule.id,
				minQuantity: 5,
				maxQuantity: 10,
				discountType: "percentage",
				discountValue: 20,
			});

			const resolved = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 15,
				basePrice: 1000,
			});

			expect(resolved.hasDiscount).toBe(false);
		});

		it("quantity within range matches tier", async () => {
			const rule = await controller.createRule({
				name: "Ranged Tier",
				scope: "global",
			});
			await controller.createTier({
				ruleId: rule.id,
				minQuantity: 5,
				maxQuantity: 20,
				discountType: "percentage",
				discountValue: 15,
			});

			const resolved = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 10,
				basePrice: 1000,
			});

			expect(resolved.hasDiscount).toBe(true);
			expect(resolved.unitPrice).toBe(850);
		});
	});

	describe("priority-based rule selection", () => {
		it("higher priority rule wins when multiple match", async () => {
			const lowPriority = await controller.createRule({
				name: "Low Priority",
				scope: "global",
				priority: 1,
			});
			await controller.createTier({
				ruleId: lowPriority.id,
				minQuantity: 1,
				discountType: "percentage",
				discountValue: 5,
			});

			const highPriority = await controller.createRule({
				name: "High Priority",
				scope: "global",
				priority: 10,
			});
			await controller.createTier({
				ruleId: highPriority.id,
				minQuantity: 1,
				discountType: "percentage",
				discountValue: 25,
			});

			const resolved = await controller.resolvePrice({
				productId: "prod_1",
				quantity: 5,
				basePrice: 1000,
			});

			expect(resolved.hasDiscount).toBe(true);
			expect(resolved.unitPrice).toBe(750); // 25% off from high-priority rule
			expect(resolved.matchedRule?.name).toBe("High Priority");
		});
	});

	describe("input validation on resolvePrice", () => {
		it("rejects non-positive quantity", async () => {
			await expect(
				controller.resolvePrice({
					productId: "prod_1",
					quantity: 0,
					basePrice: 1000,
				}),
			).rejects.toThrow("Quantity must be a positive integer");
		});

		it("rejects negative base price", async () => {
			await expect(
				controller.resolvePrice({
					productId: "prod_1",
					quantity: 1,
					basePrice: -100,
				}),
			).rejects.toThrow("Base price must be non-negative");
		});
	});

	describe("deletion safety", () => {
		it("deleting a non-existent rule returns false", async () => {
			const result = await controller.deleteRule("nonexistent");
			expect(result).toBe(false);
		});

		it("deleting a non-existent tier returns false", async () => {
			const result = await controller.deleteTier("nonexistent");
			expect(result).toBe(false);
		});
	});
});
