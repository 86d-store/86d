import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createDiscountController } from "../service-impl";

/**
 * Store endpoint integration tests for the discounts module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. Active promotions — filters by isActive, date range, and usage limits
 * 2. Validate code — enforces code validity, discount status, minimums,
 *    product/category targeting, and correct amount calculation
 * 3. Evaluate cart rules — applies automatic rules with conditions,
 *    priority ordering, and stacking rules
 * 4. Response shaping — ensures public endpoints expose only safe fields
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate store endpoint logic ────────────────────────────────────

/**
 * Simulate active-promotions endpoint: returns only currently-active
 * promotions with public-facing fields.
 */
async function simulateActivePromotions(data: DataService) {
	const controller = createDiscountController(data);
	const { discounts } = await controller.list({ isActive: true, limit: 50 });

	const now = new Date();
	const active = discounts.filter((d) => {
		if (d.startsAt && new Date(d.startsAt) > now) return false;
		if (d.endsAt && new Date(d.endsAt) < now) return false;
		if (
			d.maximumUses !== undefined &&
			d.maximumUses !== null &&
			d.usedCount >= d.maximumUses
		)
			return false;
		return true;
	});

	return {
		promotions: active.map((d) => ({
			id: d.id,
			name: d.name,
			description: d.description,
			type: d.type,
			value: d.value,
			minimumAmount: d.minimumAmount,
			endsAt: d.endsAt,
		})),
	};
}

/**
 * Simulate validate-code endpoint: validates a code against subtotal
 * and optionally scoped products/categories.
 */
async function simulateValidateCode(
	data: DataService,
	body: {
		code: string;
		subtotal: number;
		productIds?: string[];
		categoryIds?: string[];
	},
) {
	const controller = createDiscountController(data);
	const result = await controller.validateCode({
		code: body.code,
		subtotal: body.subtotal,
		...(body.productIds ? { productIds: body.productIds } : {}),
		...(body.categoryIds ? { categoryIds: body.categoryIds } : {}),
	});

	return {
		valid: result.valid,
		discountAmount: result.discountAmount,
		freeShipping: result.freeShipping,
		...(result.error ? { error: result.error } : {}),
	};
}

/**
 * Simulate evaluate-cart-rules endpoint: evaluates automatic rules.
 */
async function simulateEvaluateCartRules(
	data: DataService,
	body: {
		subtotal: number;
		itemCount: number;
		productIds?: string[];
		categoryIds?: string[];
	},
) {
	const controller = createDiscountController(data);
	return controller.evaluateCartRules({
		subtotal: body.subtotal,
		itemCount: body.itemCount,
		...(body.productIds ? { productIds: body.productIds } : {}),
		...(body.categoryIds ? { categoryIds: body.categoryIds } : {}),
	});
}

// ── Tests ────────────────────────────────────────────────────────────

describe("store endpoint: active promotions", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns active in-date promotions", async () => {
		const controller = createDiscountController(data);
		await controller.create({
			name: "Summer Sale",
			type: "percentage",
			value: 15,
			isActive: true,
		});

		const result = await simulateActivePromotions(data);

		expect(result.promotions).toHaveLength(1);
		expect(result.promotions[0].name).toBe("Summer Sale");
		expect(result.promotions[0].type).toBe("percentage");
		expect(result.promotions[0].value).toBe(15);
	});

	it("excludes inactive discounts", async () => {
		const controller = createDiscountController(data);
		await controller.create({
			name: "Active",
			type: "percentage",
			value: 10,
			isActive: true,
		});
		await controller.create({
			name: "Inactive",
			type: "percentage",
			value: 20,
			isActive: false,
		});

		const result = await simulateActivePromotions(data);
		expect(result.promotions).toHaveLength(1);
		expect(result.promotions[0].name).toBe("Active");
	});

	it("excludes expired discounts", async () => {
		const controller = createDiscountController(data);
		await controller.create({
			name: "Expired",
			type: "fixed_amount",
			value: 500,
			isActive: true,
			endsAt: new Date("2020-01-01T00:00:00.000Z"),
		});
		await controller.create({
			name: "Current",
			type: "fixed_amount",
			value: 1000,
			isActive: true,
		});

		const result = await simulateActivePromotions(data);
		expect(result.promotions).toHaveLength(1);
		expect(result.promotions[0].name).toBe("Current");
	});

	it("excludes future-scheduled discounts", async () => {
		const controller = createDiscountController(data);
		await controller.create({
			name: "Future",
			type: "percentage",
			value: 25,
			isActive: true,
			startsAt: new Date("2099-01-01T00:00:00.000Z"),
		});

		const result = await simulateActivePromotions(data);
		expect(result.promotions).toHaveLength(0);
	});

	it("excludes fully-used discounts", async () => {
		const controller = createDiscountController(data);
		const discount = await controller.create({
			name: "Limited",
			type: "percentage",
			value: 10,
			isActive: true,
			maximumUses: 1,
		});
		await controller.createCode({ discountId: discount.id, code: "LIM" });
		await controller.applyCode({ code: "LIM", subtotal: 10000 });

		const result = await simulateActivePromotions(data);
		expect(result.promotions).toHaveLength(0);
	});

	it("exposes only public fields — no usedCount or internal data", async () => {
		const controller = createDiscountController(data);
		await controller.create({
			name: "Promo",
			description: "A great deal",
			type: "percentage",
			value: 20,
			minimumAmount: 5000,
			isActive: true,
		});

		const result = await simulateActivePromotions(data);
		const promo = result.promotions[0];

		expect(promo).toHaveProperty("id");
		expect(promo).toHaveProperty("name");
		expect(promo).toHaveProperty("description");
		expect(promo).toHaveProperty("type");
		expect(promo).toHaveProperty("value");
		expect(promo).toHaveProperty("minimumAmount");
		expect(promo).not.toHaveProperty("usedCount");
		expect(promo).not.toHaveProperty("maximumUses");
		expect(promo).not.toHaveProperty("isActive");
		expect(promo).not.toHaveProperty("appliesTo");
		expect(promo).not.toHaveProperty("stackable");
	});

	it("returns empty list when no promotions exist", async () => {
		const result = await simulateActivePromotions(data);
		expect(result.promotions).toHaveLength(0);
	});
});

describe("store endpoint: validate code — happy paths", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("validates a percentage discount code", async () => {
		const controller = createDiscountController(data);
		const discount = await controller.create({
			name: "20% Off",
			type: "percentage",
			value: 20,
			isActive: true,
		});
		await controller.createCode({ discountId: discount.id, code: "SAVE20" });

		const result = await simulateValidateCode(data, {
			code: "SAVE20",
			subtotal: 10000,
		});

		expect(result.valid).toBe(true);
		expect(result.discountAmount).toBe(2000); // 20% of 10000
		expect(result.freeShipping).toBe(false);
	});

	it("validates a fixed_amount discount code", async () => {
		const controller = createDiscountController(data);
		const discount = await controller.create({
			name: "$5 Off",
			type: "fixed_amount",
			value: 500,
			isActive: true,
		});
		await controller.createCode({ discountId: discount.id, code: "FIVE" });

		const result = await simulateValidateCode(data, {
			code: "FIVE",
			subtotal: 8000,
		});

		expect(result.valid).toBe(true);
		expect(result.discountAmount).toBe(500);
		expect(result.freeShipping).toBe(false);
	});

	it("validates a free_shipping discount code", async () => {
		const controller = createDiscountController(data);
		const discount = await controller.create({
			name: "Free Shipping",
			type: "free_shipping",
			value: 0,
			isActive: true,
		});
		await controller.createCode({ discountId: discount.id, code: "FREESHIP" });

		const result = await simulateValidateCode(data, {
			code: "FREESHIP",
			subtotal: 5000,
		});

		expect(result.valid).toBe(true);
		expect(result.discountAmount).toBe(0);
		expect(result.freeShipping).toBe(true);
	});

	it("is case-insensitive for code lookup", async () => {
		const controller = createDiscountController(data);
		const discount = await controller.create({
			name: "Sale",
			type: "percentage",
			value: 10,
			isActive: true,
		});
		await controller.createCode({ discountId: discount.id, code: "SALE10" });

		const result = await simulateValidateCode(data, {
			code: "sale10",
			subtotal: 5000,
		});

		expect(result.valid).toBe(true);
		expect(result.discountAmount).toBe(500);
	});

	it("caps fixed_amount discount at subtotal", async () => {
		const controller = createDiscountController(data);
		const discount = await controller.create({
			name: "$50 Off",
			type: "fixed_amount",
			value: 5000,
			isActive: true,
		});
		await controller.createCode({ discountId: discount.id, code: "BIG" });

		const result = await simulateValidateCode(data, {
			code: "BIG",
			subtotal: 3000, // less than discount
		});

		expect(result.valid).toBe(true);
		expect(result.discountAmount).toBe(3000); // capped at subtotal
	});

	it("caps percentage at 100%", async () => {
		const controller = createDiscountController(data);
		const discount = await controller.create({
			name: "Oversized",
			type: "percentage",
			value: 150,
			isActive: true,
		});
		await controller.createCode({ discountId: discount.id, code: "OVER" });

		const result = await simulateValidateCode(data, {
			code: "OVER",
			subtotal: 10000,
		});

		expect(result.valid).toBe(true);
		expect(result.discountAmount).toBe(10000); // capped at subtotal
	});
});

describe("store endpoint: validate code — error paths", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns error for invalid code", async () => {
		const result = await simulateValidateCode(data, {
			code: "NONEXISTENT",
			subtotal: 5000,
		});

		expect(result.valid).toBe(false);
		expect(result.discountAmount).toBe(0);
		expect(result.error).toBe("Invalid promo code");
	});

	it("returns error for inactive code", async () => {
		const controller = createDiscountController(data);
		const discount = await controller.create({
			name: "Discount",
			type: "percentage",
			value: 10,
			isActive: true,
		});
		await controller.createCode({
			discountId: discount.id,
			code: "DEAD",
			isActive: false,
		});

		const result = await simulateValidateCode(data, {
			code: "DEAD",
			subtotal: 5000,
		});

		expect(result.valid).toBe(false);
		expect(result.error).toBe("This promo code is no longer active");
	});

	it("returns error for exhausted code", async () => {
		const controller = createDiscountController(data);
		const discount = await controller.create({
			name: "Limited",
			type: "percentage",
			value: 10,
			isActive: true,
		});
		await controller.createCode({
			discountId: discount.id,
			code: "ONCE",
			maximumUses: 1,
		});
		// Use it once
		await controller.applyCode({ code: "ONCE", subtotal: 5000 });

		const result = await simulateValidateCode(data, {
			code: "ONCE",
			subtotal: 5000,
		});

		expect(result.valid).toBe(false);
		expect(result.error).toBe("This promo code has reached its usage limit");
	});

	it("returns error for inactive parent discount", async () => {
		const controller = createDiscountController(data);
		const discount = await controller.create({
			name: "Disabled",
			type: "percentage",
			value: 10,
			isActive: false,
		});
		await controller.createCode({ discountId: discount.id, code: "DISABLED" });

		const result = await simulateValidateCode(data, {
			code: "DISABLED",
			subtotal: 5000,
		});

		expect(result.valid).toBe(false);
		expect(result.error).toBe("This discount is not currently active");
	});

	it("returns error for expired parent discount", async () => {
		const controller = createDiscountController(data);
		const discount = await controller.create({
			name: "Expired",
			type: "percentage",
			value: 10,
			isActive: true,
			endsAt: new Date("2020-01-01T00:00:00.000Z"),
		});
		await controller.createCode({ discountId: discount.id, code: "OLD" });

		const result = await simulateValidateCode(data, {
			code: "OLD",
			subtotal: 5000,
		});

		expect(result.valid).toBe(false);
		expect(result.error).toBe("This discount is not currently active");
	});

	it("returns error when minimum order amount is not met", async () => {
		const controller = createDiscountController(data);
		const discount = await controller.create({
			name: "Min $50",
			type: "fixed_amount",
			value: 1000,
			minimumAmount: 5000,
			isActive: true,
		});
		await controller.createCode({ discountId: discount.id, code: "MIN50" });

		const result = await simulateValidateCode(data, {
			code: "MIN50",
			subtotal: 3000, // below minimum
		});

		expect(result.valid).toBe(false);
		expect(result.error).toBe("Minimum order amount of 5000 required");
	});

	it("returns error when products don't match scope", async () => {
		const controller = createDiscountController(data);
		const discount = await controller.create({
			name: "Specific Products",
			type: "percentage",
			value: 15,
			isActive: true,
			appliesTo: "specific_products",
			appliesToIds: ["prod_abc", "prod_def"],
		});
		await controller.createCode({ discountId: discount.id, code: "SPECIFIC" });

		const result = await simulateValidateCode(data, {
			code: "SPECIFIC",
			subtotal: 5000,
			productIds: ["prod_xyz"], // not in scope
		});

		expect(result.valid).toBe(false);
		expect(result.error).toBe(
			"This discount does not apply to the items in your cart",
		);
	});

	it("validates when products match scope", async () => {
		const controller = createDiscountController(data);
		const discount = await controller.create({
			name: "Specific Products",
			type: "percentage",
			value: 15,
			isActive: true,
			appliesTo: "specific_products",
			appliesToIds: ["prod_abc", "prod_def"],
		});
		await controller.createCode({ discountId: discount.id, code: "MATCH" });

		const result = await simulateValidateCode(data, {
			code: "MATCH",
			subtotal: 5000,
			productIds: ["prod_abc"],
		});

		expect(result.valid).toBe(true);
		expect(result.discountAmount).toBe(750); // 15% of 5000
	});

	it("validates when categories match scope", async () => {
		const controller = createDiscountController(data);
		const discount = await controller.create({
			name: "Category Discount",
			type: "fixed_amount",
			value: 300,
			isActive: true,
			appliesTo: "specific_categories",
			appliesToIds: ["cat_shoes"],
		});
		await controller.createCode({ discountId: discount.id, code: "SHOES" });

		const result = await simulateValidateCode(data, {
			code: "SHOES",
			subtotal: 8000,
			categoryIds: ["cat_shoes"],
		});

		expect(result.valid).toBe(true);
		expect(result.discountAmount).toBe(300);
	});
});

describe("store endpoint: evaluate cart rules", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns empty when no rules exist", async () => {
		const result = await simulateEvaluateCartRules(data, {
			subtotal: 10000,
			itemCount: 3,
		});

		expect(result.rules).toHaveLength(0);
		expect(result.totalDiscount).toBe(0);
		expect(result.freeShipping).toBe(false);
	});

	it("applies a percentage rule when minimum subtotal is met", async () => {
		const controller = createDiscountController(data);
		await controller.createPriceRule({
			name: "10% over $50",
			type: "percentage",
			value: 10,
			conditions: [{ type: "minimum_subtotal", value: 5000 }],
			isActive: true,
		});

		const result = await simulateEvaluateCartRules(data, {
			subtotal: 8000,
			itemCount: 2,
		});

		expect(result.rules).toHaveLength(1);
		expect(result.rules[0].ruleName).toBe("10% over $50");
		expect(result.rules[0].discountAmount).toBe(800); // 10% of 8000
		expect(result.totalDiscount).toBe(800);
	});

	it("does not apply rule when condition is not met", async () => {
		const controller = createDiscountController(data);
		await controller.createPriceRule({
			name: "10% over $100",
			type: "percentage",
			value: 10,
			conditions: [{ type: "minimum_subtotal", value: 10000 }],
			isActive: true,
		});

		const result = await simulateEvaluateCartRules(data, {
			subtotal: 5000,
			itemCount: 1,
		});

		expect(result.rules).toHaveLength(0);
		expect(result.totalDiscount).toBe(0);
	});

	it("applies a minimum item count condition", async () => {
		const controller = createDiscountController(data);
		await controller.createPriceRule({
			name: "Buy 3+ get 5% off",
			type: "percentage",
			value: 5,
			conditions: [{ type: "minimum_item_count", value: 3 }],
			isActive: true,
		});

		const under = await simulateEvaluateCartRules(data, {
			subtotal: 5000,
			itemCount: 2,
		});
		expect(under.rules).toHaveLength(0);

		const over = await simulateEvaluateCartRules(data, {
			subtotal: 5000,
			itemCount: 4,
		});
		expect(over.rules).toHaveLength(1);
		expect(over.totalDiscount).toBe(250); // 5% of 5000
	});

	it("applies free shipping rule", async () => {
		const controller = createDiscountController(data);
		await controller.createPriceRule({
			name: "Free Shipping over $75",
			type: "free_shipping",
			value: 0,
			conditions: [{ type: "minimum_subtotal", value: 7500 }],
			isActive: true,
		});

		const result = await simulateEvaluateCartRules(data, {
			subtotal: 8000,
			itemCount: 1,
		});

		expect(result.freeShipping).toBe(true);
		expect(result.totalDiscount).toBe(0); // free shipping doesn't reduce subtotal
	});

	it("respects priority ordering — lower priority first", async () => {
		const controller = createDiscountController(data);
		await controller.createPriceRule({
			name: "Second",
			type: "percentage",
			value: 5,
			priority: 2,
			stackable: true,
			isActive: true,
		});
		await controller.createPriceRule({
			name: "First",
			type: "percentage",
			value: 10,
			priority: 1,
			stackable: true,
			isActive: true,
		});

		const result = await simulateEvaluateCartRules(data, {
			subtotal: 10000,
			itemCount: 1,
		});

		expect(result.rules).toHaveLength(2);
		expect(result.rules[0].ruleName).toBe("First");
		expect(result.rules[1].ruleName).toBe("Second");
	});

	it("stops after a non-stackable rule", async () => {
		const controller = createDiscountController(data);
		await controller.createPriceRule({
			name: "Non-stackable",
			type: "percentage",
			value: 20,
			priority: 1,
			stackable: false,
			isActive: true,
		});
		await controller.createPriceRule({
			name: "Would be second",
			type: "fixed_amount",
			value: 500,
			priority: 2,
			stackable: true,
			isActive: true,
		});

		const result = await simulateEvaluateCartRules(data, {
			subtotal: 10000,
			itemCount: 1,
		});

		expect(result.rules).toHaveLength(1);
		expect(result.rules[0].ruleName).toBe("Non-stackable");
		expect(result.totalDiscount).toBe(2000); // only the first rule
	});

	it("skips inactive rules", async () => {
		const controller = createDiscountController(data);
		await controller.createPriceRule({
			name: "Disabled",
			type: "percentage",
			value: 50,
			isActive: false,
		});
		await controller.createPriceRule({
			name: "Active",
			type: "percentage",
			value: 5,
			isActive: true,
		});

		const result = await simulateEvaluateCartRules(data, {
			subtotal: 10000,
			itemCount: 1,
		});

		expect(result.rules).toHaveLength(1);
		expect(result.rules[0].ruleName).toBe("Active");
	});

	it("skips expired rules", async () => {
		const controller = createDiscountController(data);
		await controller.createPriceRule({
			name: "Expired",
			type: "percentage",
			value: 50,
			isActive: true,
			endsAt: new Date("2020-01-01T00:00:00.000Z"),
		});

		const result = await simulateEvaluateCartRules(data, {
			subtotal: 10000,
			itemCount: 1,
		});

		expect(result.rules).toHaveLength(0);
	});

	it("applies product-scoped rule only when product matches", async () => {
		const controller = createDiscountController(data);
		await controller.createPriceRule({
			name: "Shoes discount",
			type: "fixed_amount",
			value: 1000,
			appliesTo: "specific_products",
			appliesToIds: ["prod_shoes"],
			isActive: true,
		});

		const noMatch = await simulateEvaluateCartRules(data, {
			subtotal: 5000,
			itemCount: 1,
			productIds: ["prod_shirt"],
		});
		expect(noMatch.rules).toHaveLength(0);

		const match = await simulateEvaluateCartRules(data, {
			subtotal: 5000,
			itemCount: 1,
			productIds: ["prod_shoes"],
		});
		expect(match.rules).toHaveLength(1);
		expect(match.totalDiscount).toBe(1000);
	});

	it("applies multiple stackable rules and calculates cascading discounts", async () => {
		const controller = createDiscountController(data);
		await controller.createPriceRule({
			name: "$10 off",
			type: "fixed_amount",
			value: 1000,
			priority: 1,
			stackable: true,
			isActive: true,
		});
		await controller.createPriceRule({
			name: "10% off remaining",
			type: "percentage",
			value: 10,
			priority: 2,
			stackable: true,
			isActive: true,
		});

		const result = await simulateEvaluateCartRules(data, {
			subtotal: 10000,
			itemCount: 1,
		});

		expect(result.rules).toHaveLength(2);
		// First: $10 off → remaining = 9000
		expect(result.rules[0].discountAmount).toBe(1000);
		// Second: 10% of 9000 = 900
		expect(result.rules[1].discountAmount).toBe(900);
		expect(result.totalDiscount).toBe(1900);
	});
});
