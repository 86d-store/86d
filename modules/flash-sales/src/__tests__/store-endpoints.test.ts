import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createFlashSaleController } from "../service-impl";

/**
 * Store endpoint integration tests for the flash-sales module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-active: returns only active sales in time window
 * 2. get-sale: by slug, not found returns null
 * 3. get-product-deal: returns deal with discount calc, null when no active sale, null when sold out
 * 4. get-product-deals: maps multiple products to their deals
 * 5. record-sale: increments stockSold, respects stockLimit
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Helpers ────────────────────────────────────────────────────────

function hoursFromNow(hours: number): Date {
	return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function hoursAgo(hours: number): Date {
	return new Date(Date.now() - hours * 60 * 60 * 1000);
}

// ── Tests ──────────────────────────────────────────────────────────

describe("store endpoint: list-active — active flash sales", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active sales within the time window", async () => {
		const ctrl = createFlashSaleController(data);

		// Active + within window — should appear
		await ctrl.createFlashSale({
			name: "Weekend Blowout",
			slug: "weekend-blowout",
			status: "active",
			startsAt: hoursAgo(2),
			endsAt: hoursFromNow(6),
		});

		// Active + within window — should appear
		await ctrl.createFlashSale({
			name: "Midnight Madness",
			slug: "midnight-madness",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(3),
		});

		const results = await ctrl.getActiveSales();

		expect(results).toHaveLength(2);
		expect(results.map((s) => s.name)).toContain("Weekend Blowout");
		expect(results.map((s) => s.name)).toContain("Midnight Madness");
	});

	it("excludes draft sales", async () => {
		const ctrl = createFlashSaleController(data);

		await ctrl.createFlashSale({
			name: "Draft Sale",
			slug: "draft-sale",
			status: "draft",
			startsAt: hoursAgo(2),
			endsAt: hoursFromNow(6),
		});

		const results = await ctrl.getActiveSales();

		expect(results).toHaveLength(0);
	});

	it("excludes ended sales", async () => {
		const ctrl = createFlashSaleController(data);

		await ctrl.createFlashSale({
			name: "Ended Sale",
			slug: "ended-sale",
			status: "ended",
			startsAt: hoursAgo(10),
			endsAt: hoursAgo(2),
		});

		const results = await ctrl.getActiveSales();

		expect(results).toHaveLength(0);
	});

	it("excludes active sales outside time window (not yet started)", async () => {
		const ctrl = createFlashSaleController(data);

		await ctrl.createFlashSale({
			name: "Future Sale",
			slug: "future-sale",
			status: "active",
			startsAt: hoursFromNow(2),
			endsAt: hoursFromNow(10),
		});

		const results = await ctrl.getActiveSales();

		expect(results).toHaveLength(0);
	});

	it("excludes active sales outside time window (already passed)", async () => {
		const ctrl = createFlashSaleController(data);

		await ctrl.createFlashSale({
			name: "Past Sale",
			slug: "past-sale",
			status: "active",
			startsAt: hoursAgo(10),
			endsAt: hoursAgo(1),
		});

		const results = await ctrl.getActiveSales();

		expect(results).toHaveLength(0);
	});

	it("includes products for each active sale", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Flash Deal",
			slug: "flash-deal",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_1",
			salePrice: 800,
			originalPrice: 1000,
		});
		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_2",
			salePrice: 1500,
			originalPrice: 2000,
		});

		const results = await ctrl.getActiveSales();

		expect(results).toHaveLength(1);
		expect(results[0].products).toHaveLength(2);
		expect(results[0].products.map((p) => p.productId)).toContain("prod_1");
		expect(results[0].products.map((p) => p.productId)).toContain("prod_2");
	});

	it("returns empty array when no sales exist", async () => {
		const ctrl = createFlashSaleController(data);
		const results = await ctrl.getActiveSales();

		expect(results).toHaveLength(0);
	});
});

describe("store endpoint: get-sale — sale by slug", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns sale by slug", async () => {
		const ctrl = createFlashSaleController(data);

		await ctrl.createFlashSale({
			name: "Summer Sale",
			slug: "summer-sale",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		const result = await ctrl.getFlashSaleBySlug("summer-sale");

		expect(result).not.toBeNull();
		expect(result?.name).toBe("Summer Sale");
		expect(result?.slug).toBe("summer-sale");
	});

	it("returns null when slug does not exist", async () => {
		const ctrl = createFlashSaleController(data);

		const result = await ctrl.getFlashSaleBySlug("nonexistent-slug");

		expect(result).toBeNull();
	});

	it("returns correct sale when multiple sales exist", async () => {
		const ctrl = createFlashSaleController(data);

		await ctrl.createFlashSale({
			name: "First Sale",
			slug: "first-sale",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});
		await ctrl.createFlashSale({
			name: "Second Sale",
			slug: "second-sale",
			status: "active",
			startsAt: hoursAgo(2),
			endsAt: hoursFromNow(8),
		});

		const result = await ctrl.getFlashSaleBySlug("second-sale");

		expect(result).not.toBeNull();
		expect(result?.name).toBe("Second Sale");
	});
});

describe("store endpoint: get-product-deal — active deal for a product", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns deal with correct discount calculation", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Big Sale",
			slug: "big-sale",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_1",
			salePrice: 750,
			originalPrice: 1000,
			stockLimit: 50,
		});

		const deal = await ctrl.getActiveProductDeal("prod_1");

		expect(deal).not.toBeNull();
		expect(deal?.productId).toBe("prod_1");
		expect(deal?.salePrice).toBe(750);
		expect(deal?.originalPrice).toBe(1000);
		expect(deal?.discountPercent).toBe(25);
		expect(deal?.flashSaleId).toBe(sale.id);
		expect(deal?.flashSaleName).toBe("Big Sale");
		expect(deal?.stockLimit).toBe(50);
		expect(deal?.stockSold).toBe(0);
		expect(deal?.stockRemaining).toBe(50);
		expect(deal?.endsAt).toEqual(sale.endsAt);
	});

	it("returns null stock fields when no stock limit is set", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Unlimited Sale",
			slug: "unlimited-sale",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_1",
			salePrice: 500,
			originalPrice: 1000,
		});

		const deal = await ctrl.getActiveProductDeal("prod_1");

		expect(deal).not.toBeNull();
		expect(deal?.stockLimit).toBeNull();
		expect(deal?.stockRemaining).toBeNull();
	});

	it("returns null when no active sale exists for product", async () => {
		const ctrl = createFlashSaleController(data);

		const deal = await ctrl.getActiveProductDeal("prod_nonexistent");

		expect(deal).toBeNull();
	});

	it("returns null when sale is draft", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Draft Sale",
			slug: "draft-sale",
			status: "draft",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_1",
			salePrice: 500,
			originalPrice: 1000,
		});

		const deal = await ctrl.getActiveProductDeal("prod_1");

		expect(deal).toBeNull();
	});

	it("returns null when sale is not yet in time window", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Future Sale",
			slug: "future-sale",
			status: "active",
			startsAt: hoursFromNow(2),
			endsAt: hoursFromNow(10),
		});

		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_1",
			salePrice: 500,
			originalPrice: 1000,
		});

		const deal = await ctrl.getActiveProductDeal("prod_1");

		expect(deal).toBeNull();
	});

	it("returns null when product is sold out", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Limited Sale",
			slug: "limited-sale",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_1",
			salePrice: 500,
			originalPrice: 1000,
			stockLimit: 10,
		});

		// Sell all stock
		await ctrl.recordSale(sale.id, "prod_1", 10);

		const deal = await ctrl.getActiveProductDeal("prod_1");

		expect(deal).toBeNull();
	});

	it("returns deal when stock is partially sold but not exhausted", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Partial Stock Sale",
			slug: "partial-stock-sale",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_1",
			salePrice: 500,
			originalPrice: 1000,
			stockLimit: 10,
		});

		await ctrl.recordSale(sale.id, "prod_1", 7);

		const deal = await ctrl.getActiveProductDeal("prod_1");

		expect(deal).not.toBeNull();
		expect(deal?.stockSold).toBe(7);
		expect(deal?.stockRemaining).toBe(3);
	});

	it("calculates discount percent correctly for various prices", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Discount Test",
			slug: "discount-test",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		// 33% off ($30 -> $20)
		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_third_off",
			salePrice: 2000,
			originalPrice: 3000,
		});

		const deal = await ctrl.getActiveProductDeal("prod_third_off");

		expect(deal).not.toBeNull();
		expect(deal?.discountPercent).toBe(33);
	});
});

describe("store endpoint: get-product-deals — deals for multiple products", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("maps multiple products to their active deals", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Multi-Product Sale",
			slug: "multi-product-sale",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_1",
			salePrice: 800,
			originalPrice: 1000,
		});
		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_2",
			salePrice: 1500,
			originalPrice: 2000,
		});

		const deals = await ctrl.getActiveProductDeals(["prod_1", "prod_2"]);

		expect(Object.keys(deals)).toHaveLength(2);
		expect(deals.prod_1).toBeDefined();
		expect(deals.prod_1.salePrice).toBe(800);
		expect(deals.prod_1.discountPercent).toBe(20);
		expect(deals.prod_2).toBeDefined();
		expect(deals.prod_2.salePrice).toBe(1500);
		expect(deals.prod_2.discountPercent).toBe(25);
	});

	it("omits products without active deals", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Partial Sale",
			slug: "partial-sale",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_1",
			salePrice: 800,
			originalPrice: 1000,
		});

		const deals = await ctrl.getActiveProductDeals(["prod_1", "prod_no_deal"]);

		expect(Object.keys(deals)).toHaveLength(1);
		expect(deals.prod_1).toBeDefined();
		expect(deals.prod_no_deal).toBeUndefined();
	});

	it("returns empty object when no products have deals", async () => {
		const ctrl = createFlashSaleController(data);

		const deals = await ctrl.getActiveProductDeals([
			"prod_a",
			"prod_b",
			"prod_c",
		]);

		expect(Object.keys(deals)).toHaveLength(0);
	});

	it("returns empty object for empty product list", async () => {
		const ctrl = createFlashSaleController(data);

		const deals = await ctrl.getActiveProductDeals([]);

		expect(Object.keys(deals)).toHaveLength(0);
	});

	it("excludes sold-out products from deals map", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Mixed Stock Sale",
			slug: "mixed-stock-sale",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_available",
			salePrice: 800,
			originalPrice: 1000,
			stockLimit: 20,
		});
		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_soldout",
			salePrice: 500,
			originalPrice: 1000,
			stockLimit: 5,
		});

		// Sell out prod_soldout
		await ctrl.recordSale(sale.id, "prod_soldout", 5);

		const deals = await ctrl.getActiveProductDeals([
			"prod_available",
			"prod_soldout",
		]);

		expect(Object.keys(deals)).toHaveLength(1);
		expect(deals.prod_available).toBeDefined();
		expect(deals.prod_soldout).toBeUndefined();
	});
});

describe("store endpoint: record-sale — stock tracking", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("increments stockSold by the given quantity", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Stock Sale",
			slug: "stock-sale",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_1",
			salePrice: 800,
			originalPrice: 1000,
			stockLimit: 100,
		});

		const result = await ctrl.recordSale(sale.id, "prod_1", 3);

		expect(result).not.toBeNull();
		expect(result?.stockSold).toBe(3);
	});

	it("accumulates stockSold across multiple recordSale calls", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Accumulate Sale",
			slug: "accumulate-sale",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_1",
			salePrice: 800,
			originalPrice: 1000,
			stockLimit: 100,
		});

		await ctrl.recordSale(sale.id, "prod_1", 5);
		await ctrl.recordSale(sale.id, "prod_1", 10);
		const result = await ctrl.recordSale(sale.id, "prod_1", 2);

		expect(result).not.toBeNull();
		expect(result?.stockSold).toBe(17);
	});

	it("returns null when quantity would exceed stockLimit", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Limited Sale",
			slug: "limited-sale",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_1",
			salePrice: 800,
			originalPrice: 1000,
			stockLimit: 10,
		});

		await ctrl.recordSale(sale.id, "prod_1", 8);

		// Trying to sell 5 more when only 2 remain
		const result = await ctrl.recordSale(sale.id, "prod_1", 5);

		expect(result).toBeNull();
	});

	it("allows sale up to exactly the stock limit", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Exact Limit Sale",
			slug: "exact-limit-sale",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_1",
			salePrice: 800,
			originalPrice: 1000,
			stockLimit: 10,
		});

		const result = await ctrl.recordSale(sale.id, "prod_1", 10);

		expect(result).not.toBeNull();
		expect(result?.stockSold).toBe(10);
	});

	it("returns null when product does not exist in the sale", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Empty Sale",
			slug: "empty-sale",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		const result = await ctrl.recordSale(sale.id, "prod_nonexistent", 1);

		expect(result).toBeNull();
	});

	it("allows unlimited sales when no stockLimit is set", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Unlimited Sale",
			slug: "unlimited-sale",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_1",
			salePrice: 800,
			originalPrice: 1000,
		});

		const result = await ctrl.recordSale(sale.id, "prod_1", 9999);

		expect(result).not.toBeNull();
		expect(result?.stockSold).toBe(9999);
	});

	it("rejects sale of exactly one more than remaining stock", async () => {
		const ctrl = createFlashSaleController(data);

		const sale = await ctrl.createFlashSale({
			name: "Boundary Sale",
			slug: "boundary-sale",
			status: "active",
			startsAt: hoursAgo(1),
			endsAt: hoursFromNow(5),
		});

		await ctrl.addProduct({
			flashSaleId: sale.id,
			productId: "prod_1",
			salePrice: 800,
			originalPrice: 1000,
			stockLimit: 10,
		});

		await ctrl.recordSale(sale.id, "prod_1", 10);

		// Stock is fully sold — even 1 more should fail
		const result = await ctrl.recordSale(sale.id, "prod_1", 1);

		expect(result).toBeNull();
	});
});
