import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createDiscountController } from "../service-impl";

/**
 * Security regression tests for discounts endpoints.
 *
 * Discounts handle monetary values and promotional codes that directly
 * affect revenue. These tests verify:
 * - Usage limit enforcement: codes and discounts respect maximumUses
 * - Date range validation: expired/future discounts are rejected
 * - Stacking rules: non-stackable price rules prevent double-dipping
 * - Fixed amount caps: discounts never exceed the cart subtotal
 * - Code uniqueness: case-insensitive lookup prevents duplicate redemption
 * - Cascading deletes: deleting a discount removes all its codes
 * - Discount isolation: codes for one discount don't leak to another
 */

describe("discounts endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createDiscountController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createDiscountController(mockData);
	});

	// ── Usage Limit Enforcement ────────────────────────────────────

	describe("usage limit enforcement", () => {
		it("discount-level maximumUses blocks validation after exhaustion", async () => {
			const discount = await controller.create({
				name: "One-time offer",
				type: "fixed_amount",
				value: 500,
				maximumUses: 1,
			});
			await controller.createCode({ discountId: discount.id, code: "ONCE" });

			const first = await controller.applyCode({
				code: "ONCE",
				subtotal: 5000,
			});
			expect(first.valid).toBe(true);

			const second = await controller.validateCode({
				code: "ONCE",
				subtotal: 5000,
			});
			expect(second.valid).toBe(false);
			expect(second.error).toBeTruthy();
		});

		it("code-level maximumUses blocks validation independently of discount limit", async () => {
			const discount = await controller.create({
				name: "Unlimited discount",
				type: "percentage",
				value: 10,
				// No maximumUses on the discount itself
			});
			await controller.createCode({
				discountId: discount.id,
				code: "CODEONCE",
				maximumUses: 1,
			});

			await controller.applyCode({ code: "CODEONCE", subtotal: 5000 });

			const result = await controller.validateCode({
				code: "CODEONCE",
				subtotal: 5000,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toContain("usage limit");
		});

		it("multiple codes on same discount track usage independently", async () => {
			const discount = await controller.create({
				name: "Multi-code",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({
				discountId: discount.id,
				code: "CODEA",
				maximumUses: 1,
			});
			await controller.createCode({
				discountId: discount.id,
				code: "CODEB",
				maximumUses: 1,
			});

			await controller.applyCode({ code: "CODEA", subtotal: 5000 });

			// CODEA is exhausted
			const resultA = await controller.validateCode({
				code: "CODEA",
				subtotal: 5000,
			});
			expect(resultA.valid).toBe(false);

			// CODEB is still valid
			const resultB = await controller.validateCode({
				code: "CODEB",
				subtotal: 5000,
			});
			expect(resultB.valid).toBe(true);
		});

		it("applyCode increments both discount and code counters atomically", async () => {
			const discount = await controller.create({
				name: "Counter check",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({ discountId: discount.id, code: "COUNT" });

			await controller.applyCode({ code: "COUNT", subtotal: 5000 });
			await controller.applyCode({ code: "COUNT", subtotal: 3000 });

			const d = await controller.getById(discount.id);
			const c = await controller.getCodeByValue("COUNT");
			expect(d?.usedCount).toBe(2);
			expect(c?.usedCount).toBe(2);
		});
	});

	// ── Date Range Validation ──────────────────────────────────────

	describe("date range validation", () => {
		it("rejects code for discount that has not started yet", async () => {
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);

			const discount = await controller.create({
				name: "Future sale",
				type: "percentage",
				value: 25,
				startsAt: tomorrow,
			});
			await controller.createCode({ discountId: discount.id, code: "EARLY" });

			const result = await controller.validateCode({
				code: "EARLY",
				subtotal: 10000,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toContain("not currently active");
		});

		it("rejects code for expired discount", async () => {
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);

			const discount = await controller.create({
				name: "Expired sale",
				type: "percentage",
				value: 25,
				endsAt: yesterday,
			});
			await controller.createCode({ discountId: discount.id, code: "LATE" });

			const result = await controller.validateCode({
				code: "LATE",
				subtotal: 10000,
			});
			expect(result.valid).toBe(false);
		});

		it("accepts code within valid date window", async () => {
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);

			const discount = await controller.create({
				name: "Active window",
				type: "percentage",
				value: 10,
				startsAt: yesterday,
				endsAt: tomorrow,
			});
			await controller.createCode({ discountId: discount.id, code: "INRANGE" });

			const result = await controller.validateCode({
				code: "INRANGE",
				subtotal: 5000,
			});
			expect(result.valid).toBe(true);
		});
	});

	// ── Fixed Amount Boundary Conditions ───────────────────────────

	describe("fixed amount boundary conditions", () => {
		it("fixed amount discount is capped at subtotal", async () => {
			const discount = await controller.create({
				name: "Big coupon",
				type: "fixed_amount",
				value: 50000,
			});
			await controller.createCode({ discountId: discount.id, code: "BIGCAP" });

			const result = await controller.validateCode({
				code: "BIGCAP",
				subtotal: 1000,
			});
			expect(result.valid).toBe(true);
			expect(result.discountAmount).toBe(1000); // Capped at subtotal, not 50000
		});

		it("fixed amount discount equals subtotal when values match", async () => {
			const discount = await controller.create({
				name: "Exact match",
				type: "fixed_amount",
				value: 2000,
			});
			await controller.createCode({ discountId: discount.id, code: "EXACT" });

			const result = await controller.validateCode({
				code: "EXACT",
				subtotal: 2000,
			});
			expect(result.valid).toBe(true);
			expect(result.discountAmount).toBe(2000);
		});

		it("percentage discount rounds to nearest cent", async () => {
			const discount = await controller.create({
				name: "Odd percentage",
				type: "percentage",
				value: 33,
			});
			await controller.createCode({ discountId: discount.id, code: "ODD" });

			// 33% of 1000 = 330 (exact). 33% of 999 = 329.67 -> rounds to 330
			const result = await controller.validateCode({
				code: "ODD",
				subtotal: 999,
			});
			expect(result.valid).toBe(true);
			expect(result.discountAmount).toBe(Math.round((999 * 33) / 100));
		});
	});

	// ── Minimum Amount Enforcement ─────────────────────────────────

	describe("minimum amount enforcement", () => {
		it("rejects code when subtotal is below minimumAmount", async () => {
			const discount = await controller.create({
				name: "Min order",
				type: "percentage",
				value: 10,
				minimumAmount: 5000,
			});
			await controller.createCode({ discountId: discount.id, code: "MINREQ" });

			const result = await controller.validateCode({
				code: "MINREQ",
				subtotal: 4999,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toContain("5000");
		});

		it("accepts code when subtotal exactly meets minimumAmount", async () => {
			const discount = await controller.create({
				name: "Min exact",
				type: "percentage",
				value: 10,
				minimumAmount: 5000,
			});
			await controller.createCode({
				discountId: discount.id,
				code: "MINEXACT",
			});

			const result = await controller.validateCode({
				code: "MINEXACT",
				subtotal: 5000,
			});
			expect(result.valid).toBe(true);
		});
	});

	// ── Code Case & Whitespace Normalization ───────────────────────

	describe("code normalization", () => {
		it("code lookup is case-insensitive", async () => {
			const discount = await controller.create({
				name: "Case test",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({ discountId: discount.id, code: "SUMMER" });

			const lower = await controller.getCodeByValue("summer");
			const mixed = await controller.getCodeByValue("SuMmEr");
			expect(lower?.code).toBe("SUMMER");
			expect(mixed?.code).toBe("SUMMER");
		});

		it("code creation trims whitespace and uppercases", async () => {
			const discount = await controller.create({
				name: "Trim test",
				type: "percentage",
				value: 10,
			});
			const code = await controller.createCode({
				discountId: discount.id,
				code: "  hello world  ",
			});
			expect(code.code).toBe("HELLO WORLD");
		});

		it("validate/apply code works with mixed case input", async () => {
			const discount = await controller.create({
				name: "Mixed case",
				type: "fixed_amount",
				value: 500,
			});
			await controller.createCode({
				discountId: discount.id,
				code: "MIXEDCASE",
			});

			const result = await controller.applyCode({
				code: "mixedCase",
				subtotal: 5000,
			});
			expect(result.valid).toBe(true);
			expect(result.discountAmount).toBe(500);
		});
	});

	// ── Inactive Status Enforcement ────────────────────────────────

	describe("inactive status enforcement", () => {
		it("inactive discount code rejects validation", async () => {
			const discount = await controller.create({
				name: "Active discount",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({
				discountId: discount.id,
				code: "INACTIVECODE",
				isActive: false,
			});

			const result = await controller.validateCode({
				code: "INACTIVECODE",
				subtotal: 5000,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toContain("no longer active");
		});

		it("deactivated discount rejects all its codes", async () => {
			const discount = await controller.create({
				name: "Deactivated",
				type: "percentage",
				value: 20,
				isActive: false,
			});
			await controller.createCode({ discountId: discount.id, code: "DEAD" });

			const result = await controller.validateCode({
				code: "DEAD",
				subtotal: 5000,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toContain("not currently active");
		});
	});

	// ── Product/Category Targeting ─────────────────────────────────

	describe("product and category targeting", () => {
		it("specific_products discount rejects non-matching products", async () => {
			const discount = await controller.create({
				name: "Product only",
				type: "percentage",
				value: 10,
				appliesTo: "specific_products",
				appliesToIds: ["prod_1", "prod_2"],
			});
			await controller.createCode({ discountId: discount.id, code: "PRODSEC" });

			const result = await controller.validateCode({
				code: "PRODSEC",
				subtotal: 5000,
				productIds: ["prod_999"],
			});
			expect(result.valid).toBe(false);
			expect(result.error).toContain("does not apply");
		});

		it("specific_categories discount rejects non-matching categories", async () => {
			const discount = await controller.create({
				name: "Category only",
				type: "percentage",
				value: 15,
				appliesTo: "specific_categories",
				appliesToIds: ["cat_shoes"],
			});
			await controller.createCode({ discountId: discount.id, code: "CATSEC" });

			const result = await controller.validateCode({
				code: "CATSEC",
				subtotal: 5000,
				categoryIds: ["cat_hats"],
			});
			expect(result.valid).toBe(false);
			expect(result.error).toContain("does not apply");
		});
	});

	// ── Cascading Delete Data Integrity ────────────────────────────

	describe("cascading delete — no orphaned codes", () => {
		it("deleting a discount removes all associated codes", async () => {
			const discount = await controller.create({
				name: "Doomed",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({ discountId: discount.id, code: "ORPHAN1" });
			await controller.createCode({ discountId: discount.id, code: "ORPHAN2" });
			await controller.createCode({ discountId: discount.id, code: "ORPHAN3" });

			await controller.delete(discount.id);

			expect(await controller.getById(discount.id)).toBeNull();
			expect(await controller.listCodes(discount.id)).toHaveLength(0);
			expect(await controller.getCodeByValue("ORPHAN1")).toBeNull();
			expect(await controller.getCodeByValue("ORPHAN2")).toBeNull();
		});

		it("deleting one discount does not affect another discount's codes", async () => {
			const keepDiscount = await controller.create({
				name: "Keep",
				type: "percentage",
				value: 10,
			});
			const deleteDiscount = await controller.create({
				name: "Delete",
				type: "percentage",
				value: 20,
			});

			await controller.createCode({
				discountId: keepDiscount.id,
				code: "KEEPCODE",
			});
			await controller.createCode({
				discountId: deleteDiscount.id,
				code: "DELCODE",
			});

			await controller.delete(deleteDiscount.id);

			expect(await controller.getById(keepDiscount.id)).not.toBeNull();
			const keepCodes = await controller.listCodes(keepDiscount.id);
			expect(keepCodes).toHaveLength(1);
			expect(keepCodes[0]?.code).toBe("KEEPCODE");
		});
	});

	// ── Cart Price Rule Stacking Security ──────────────────────────

	describe("cart price rule stacking security", () => {
		it("non-stackable rule prevents subsequent rules from applying", async () => {
			await controller.createPriceRule({
				name: "Non-stackable 20%",
				type: "percentage",
				value: 20,
				priority: 0,
				stackable: false,
			});
			await controller.createPriceRule({
				name: "Extra $5",
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
			expect(result.rules[0]?.ruleName).toBe("Non-stackable 20%");
			expect(result.totalDiscount).toBe(2000);
		});

		it("price rule with exhausted maximumUses is excluded from evaluation", async () => {
			const rule = await controller.createPriceRule({
				name: "Limited auto-discount",
				type: "percentage",
				value: 50,
				maximumUses: 2,
			});

			// Simulate exhaustion by setting usedCount to maximumUses
			await mockData.upsert("cartPriceRule", rule.id, {
				...rule,
				usedCount: 2,
			});

			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 1,
			});
			expect(result.rules).toHaveLength(0);
			expect(result.totalDiscount).toBe(0);
		});

		it("stacked percentage rules reduce remaining subtotal for subsequent rules", async () => {
			await controller.createPriceRule({
				name: "First 10%",
				type: "percentage",
				value: 10,
				priority: 0,
				stackable: true,
			});
			await controller.createPriceRule({
				name: "Second 10%",
				type: "percentage",
				value: 10,
				priority: 1,
				stackable: true,
			});

			const result = await controller.evaluateCartRules({
				subtotal: 10000,
				itemCount: 1,
			});

			expect(result.rules).toHaveLength(2);
			// First rule: 10% of 10000 = 1000
			expect(result.rules[0]?.discountAmount).toBe(1000);
			// Second rule: 10% of 9000 (remaining) = 900
			expect(result.rules[1]?.discountAmount).toBe(900);
			expect(result.totalDiscount).toBe(1900);
		});
	});

	// ── Orphaned Code Validation ───────────────────────────────────

	describe("orphaned code safety", () => {
		it("code pointing to deleted discount returns error on validation", async () => {
			const discount = await controller.create({
				name: "Temporary",
				type: "percentage",
				value: 10,
			});
			await controller.createCode({
				discountId: discount.id,
				code: "ORPHANTEST",
			});

			// Directly delete the discount without cascading (simulate data inconsistency)
			await mockData.delete("discount", discount.id);

			const result = await controller.validateCode({
				code: "ORPHANTEST",
				subtotal: 5000,
			});
			expect(result.valid).toBe(false);
			expect(result.error).toContain("Discount not found");
		});
	});
});
