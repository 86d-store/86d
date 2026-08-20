import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPriceListController } from "../service-impl";

/**
 * Store endpoint integration tests for the price-lists module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. resolve-price: resolves the best price for a product
 * 2. resolve-prices: resolves prices for multiple products
 * 3. list-price-lists: returns active price lists
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateResolvePrice(
	data: DataService,
	productId: string,
	query: {
		currency?: string;
		customerGroupId?: string;
		quantity?: number;
	} = {},
) {
	const controller = createPriceListController(data);
	const price = await controller.resolvePrice(productId, query);
	if (!price) {
		return { error: "No price available", status: 404 };
	}
	return { price };
}

async function simulateResolvePrices(
	data: DataService,
	productIds: string[],
	query: {
		currency?: string;
		customerGroupId?: string;
		quantity?: number;
	} = {},
) {
	const controller = createPriceListController(data);
	const prices = await controller.resolvePrices(productIds, query);
	return { prices };
}

async function simulateListPriceLists(
	data: DataService,
	query: { take?: number; skip?: number } = {},
) {
	const controller = createPriceListController(data);
	const priceLists = await controller.listPriceLists({
		status: "active",
		...query,
	});
	return { priceLists };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: resolve price — best price for product", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("resolves price from an active price list", async () => {
		const ctrl = createPriceListController(data);
		const pl = await ctrl.createPriceList({
			name: "Retail",
			slug: "retail",
			currency: "USD",
			status: "active",
			priority: 1,
		});
		await ctrl.setPrice({
			priceListId: pl.id,
			productId: "prod_1",
			price: 1999,
		});

		const result = await simulateResolvePrice(data, "prod_1");

		expect("price" in result).toBe(true);
		if ("price" in result) {
			expect(result.price.price).toBe(1999);
		}
	});

	it("returns 404 when no price exists", async () => {
		const result = await simulateResolvePrice(data, "prod_unknown");

		expect(result).toEqual({ error: "No price available", status: 404 });
	});

	it("resolves price filtered by currency", async () => {
		const ctrl = createPriceListController(data);
		const usd = await ctrl.createPriceList({
			name: "USD Prices",
			slug: "usd-prices",
			currency: "USD",
			status: "active",
			priority: 1,
		});
		await ctrl.setPrice({
			priceListId: usd.id,
			productId: "prod_1",
			price: 2000,
		});
		const eur = await ctrl.createPriceList({
			name: "EUR Prices",
			slug: "eur-prices",
			currency: "EUR",
			status: "active",
			priority: 1,
		});
		await ctrl.setPrice({
			priceListId: eur.id,
			productId: "prod_1",
			price: 1800,
		});

		const result = await simulateResolvePrice(data, "prod_1", {
			currency: "EUR",
		});

		expect("price" in result).toBe(true);
		if ("price" in result) {
			expect(result.price.price).toBe(1800);
		}
	});
});

describe("store endpoint: resolve prices — bulk resolution", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("resolves prices for multiple products", async () => {
		const ctrl = createPriceListController(data);
		const pl = await ctrl.createPriceList({
			name: "Default",
			slug: "default",
			currency: "USD",
			status: "active",
			priority: 1,
		});
		await ctrl.setPrice({
			priceListId: pl.id,
			productId: "prod_a",
			price: 999,
		});
		await ctrl.setPrice({
			priceListId: pl.id,
			productId: "prod_b",
			price: 1499,
		});

		const result = await simulateResolvePrices(data, [
			"prod_a",
			"prod_b",
			"prod_c",
		]);

		expect("prices" in result).toBe(true);
		if ("prices" in result) {
			expect(result.prices.prod_a).toBeDefined();
			expect(result.prices.prod_b).toBeDefined();
		}
	});
});

describe("store endpoint: list price lists — active only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active price lists", async () => {
		const ctrl = createPriceListController(data);
		await ctrl.createPriceList({
			name: "Active List",
			slug: "active-list",
			currency: "USD",
			status: "active",
			priority: 1,
		});
		await ctrl.createPriceList({
			name: "Inactive List",
			slug: "inactive-list",
			currency: "USD",
			status: "inactive",
			priority: 2,
		});

		const result = await simulateListPriceLists(data);

		expect(result.priceLists).toHaveLength(1);
		expect(result.priceLists[0].name).toBe("Active List");
	});

	it("returns empty when no active lists exist", async () => {
		const result = await simulateListPriceLists(data);

		expect(result.priceLists).toHaveLength(0);
	});
});
