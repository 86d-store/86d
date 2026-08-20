import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createBulkPricingController } from "../service-impl";

/**
 * Store endpoint integration tests for the bulk-pricing module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. resolve-price: calculates discounted price for a product at a quantity
 * 2. preview-tiers: returns tier breakdown for a product rule
 * 3. list-rules: active rules for a product (public product page display)
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateResolvePrice(
	data: DataService,
	body: {
		productId: string;
		variantId?: string;
		quantity: number;
		basePrice: number;
	},
) {
	const controller = createBulkPricingController(data);
	const resolved = await controller.resolvePrice(body);
	return { price: resolved };
}

async function simulatePreviewTiers(
	data: DataService,
	ruleId: string,
	basePrice: number,
) {
	const controller = createBulkPricingController(data);
	const tiers = await controller.previewTiers(ruleId, basePrice);
	return { tiers };
}

async function simulateListActiveRules(data: DataService, productId: string) {
	const controller = createBulkPricingController(data);
	const rules = await controller.listRules({
		scope: "product",
		targetId: productId,
		active: true,
	});
	return { rules };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: resolve price — quantity discount", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns discounted price when matching a tier", async () => {
		const ctrl = createBulkPricingController(data);
		const rule = await ctrl.createRule({
			name: "Volume Discount",
			scope: "product",
			targetId: "prod_1",
			priority: 1,
		});
		await ctrl.createTier({
			ruleId: rule.id,
			minQuantity: 5,
			discountType: "percentage",
			discountValue: 10,
		});

		const result = await simulateResolvePrice(data, {
			productId: "prod_1",
			quantity: 10,
			basePrice: 1000,
		});

		expect(result.price.hasDiscount).toBe(true);
		expect(result.price.unitPrice).toBe(900);
		expect(result.price.discountPerUnit).toBe(100);
	});

	it("returns base price when no tier matches", async () => {
		const ctrl = createBulkPricingController(data);
		const rule = await ctrl.createRule({
			name: "High Volume",
			scope: "product",
			targetId: "prod_1",
			priority: 1,
		});
		await ctrl.createTier({
			ruleId: rule.id,
			minQuantity: 100,
			discountType: "percentage",
			discountValue: 20,
		});

		const result = await simulateResolvePrice(data, {
			productId: "prod_1",
			quantity: 5,
			basePrice: 1000,
		});

		expect(result.price.hasDiscount).toBe(false);
		expect(result.price.unitPrice).toBe(1000);
	});

	it("returns base price when no rules exist", async () => {
		const result = await simulateResolvePrice(data, {
			productId: "prod_none",
			quantity: 10,
			basePrice: 2000,
		});

		expect(result.price.hasDiscount).toBe(false);
		expect(result.price.unitPrice).toBe(2000);
		expect(result.price.totalPrice).toBe(20000);
	});

	it("applies fixed amount discount", async () => {
		const ctrl = createBulkPricingController(data);
		const rule = await ctrl.createRule({
			name: "Bulk Savings",
			scope: "product",
			targetId: "prod_1",
			priority: 1,
		});
		await ctrl.createTier({
			ruleId: rule.id,
			minQuantity: 3,
			discountType: "fixed_amount",
			discountValue: 200,
		});

		const result = await simulateResolvePrice(data, {
			productId: "prod_1",
			quantity: 5,
			basePrice: 1000,
		});

		expect(result.price.hasDiscount).toBe(true);
		expect(result.price.unitPrice).toBe(800);
	});

	it("applies fixed price override", async () => {
		const ctrl = createBulkPricingController(data);
		const rule = await ctrl.createRule({
			name: "Wholesale",
			scope: "product",
			targetId: "prod_1",
			priority: 1,
		});
		await ctrl.createTier({
			ruleId: rule.id,
			minQuantity: 10,
			discountType: "fixed_price",
			discountValue: 750,
		});

		const result = await simulateResolvePrice(data, {
			productId: "prod_1",
			quantity: 10,
			basePrice: 1000,
		});

		expect(result.price.hasDiscount).toBe(true);
		expect(result.price.unitPrice).toBe(750);
	});
});

describe("store endpoint: preview tiers — tier display", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns tier previews for a rule", async () => {
		const ctrl = createBulkPricingController(data);
		const rule = await ctrl.createRule({
			name: "Volume Pricing",
			scope: "product",
			targetId: "prod_1",
			priority: 1,
		});
		await ctrl.createTier({
			ruleId: rule.id,
			minQuantity: 5,
			discountType: "percentage",
			discountValue: 10,
		});
		await ctrl.createTier({
			ruleId: rule.id,
			minQuantity: 20,
			discountType: "percentage",
			discountValue: 20,
		});

		const result = await simulatePreviewTiers(data, rule.id, 1000);

		expect(result.tiers).toHaveLength(2);
	});

	it("returns empty for rule with no tiers", async () => {
		const ctrl = createBulkPricingController(data);
		const rule = await ctrl.createRule({
			name: "Empty Rule",
			scope: "product",
			targetId: "prod_1",
			priority: 1,
		});

		const result = await simulatePreviewTiers(data, rule.id, 1000);

		expect(result.tiers).toHaveLength(0);
	});
});

describe("store endpoint: list active rules — product page", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns active rules for a product", async () => {
		const ctrl = createBulkPricingController(data);
		await ctrl.createRule({
			name: "Active Rule",
			scope: "product",
			targetId: "prod_1",
			priority: 1,
			active: true,
		});
		await ctrl.createRule({
			name: "Inactive Rule",
			scope: "product",
			targetId: "prod_1",
			priority: 2,
			active: false,
		});

		const result = await simulateListActiveRules(data, "prod_1");

		expect(result.rules).toHaveLength(1);
		expect(result.rules[0].name).toBe("Active Rule");
	});

	it("returns empty for product with no rules", async () => {
		const result = await simulateListActiveRules(data, "prod_none");

		expect(result.rules).toHaveLength(0);
	});
});
