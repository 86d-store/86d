import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createMultiCurrencyController } from "../service-impl";

/**
 * Store endpoint integration tests for the multi-currency module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-currencies: returns active currencies
 * 2. convert-price: converts an amount between currencies
 * 3. product-price: gets product price in target currency (override priority)
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListCurrencies(data: DataService) {
	const controller = createMultiCurrencyController(data);
	const currencies = await controller.list({ activeOnly: true });
	return { currencies };
}

async function simulateConvertPrice(
	data: DataService,
	body: { amount: number; to: string; from?: string },
) {
	const controller = createMultiCurrencyController(data);
	const converted = await controller.convert(body);
	if (!converted) {
		return { error: "Conversion failed", status: 400 };
	}
	return { converted };
}

async function simulateProductPrice(
	data: DataService,
	body: { productId: string; basePriceInCents: number; currencyCode: string },
) {
	const controller = createMultiCurrencyController(data);
	const price = await controller.getProductPrice(body);
	if (!price) {
		return { error: "Price not available", status: 400 };
	}
	return { price };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list currencies — active only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active currencies", async () => {
		const ctrl = createMultiCurrencyController(data);
		await ctrl.create({
			code: "USD",
			name: "US Dollar",
			symbol: "$",
			exchangeRate: 1,
			isBase: true,
			isActive: true,
		});
		const eur = await ctrl.create({
			code: "EUR",
			name: "Euro",
			symbol: "€",
			exchangeRate: 0.85,
			isBase: false,
			isActive: true,
		});
		await ctrl.update(eur.id, { isActive: false });

		const result = await simulateListCurrencies(data);

		expect(result.currencies).toHaveLength(1);
		expect(result.currencies[0].code).toBe("USD");
	});

	it("returns empty when no currencies configured", async () => {
		const result = await simulateListCurrencies(data);

		expect(result.currencies).toHaveLength(0);
	});

	it("returns multiple active currencies", async () => {
		const ctrl = createMultiCurrencyController(data);
		await ctrl.create({
			code: "USD",
			name: "US Dollar",
			symbol: "$",
			exchangeRate: 1,
			isBase: true,
			isActive: true,
		});
		await ctrl.create({
			code: "GBP",
			name: "British Pound",
			symbol: "£",
			exchangeRate: 0.79,
			isBase: false,
			isActive: true,
		});
		await ctrl.create({
			code: "JPY",
			name: "Japanese Yen",
			symbol: "¥",
			exchangeRate: 150.5,
			isBase: false,
			isActive: true,
		});

		const result = await simulateListCurrencies(data);

		expect(result.currencies).toHaveLength(3);
	});
});

describe("store endpoint: convert price", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("converts between currencies using exchange rates", async () => {
		const ctrl = createMultiCurrencyController(data);
		await ctrl.create({
			code: "USD",
			name: "US Dollar",
			symbol: "$",
			exchangeRate: 1,
			isBase: true,
			isActive: true,
		});
		await ctrl.create({
			code: "EUR",
			name: "Euro",
			symbol: "€",
			exchangeRate: 0.85,
			isBase: false,
			isActive: true,
		});

		const result = await simulateConvertPrice(data, {
			amount: 1000,
			to: "EUR",
		});

		expect("converted" in result).toBe(true);
		if ("converted" in result) {
			expect(result.converted.amount).toBeDefined();
			expect(result.converted.currency.code).toBe("EUR");
		}
	});

	it("returns error for unknown currency", async () => {
		const ctrl = createMultiCurrencyController(data);
		await ctrl.create({
			code: "USD",
			name: "US Dollar",
			symbol: "$",
			exchangeRate: 1,
			isBase: true,
			isActive: true,
		});

		const result = await simulateConvertPrice(data, {
			amount: 1000,
			to: "FAKE",
		});

		expect(result).toEqual({ error: "Conversion failed", status: 400 });
	});
});

describe("store endpoint: product price — override priority", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns converted price for product", async () => {
		const ctrl = createMultiCurrencyController(data);
		await ctrl.create({
			code: "USD",
			name: "US Dollar",
			symbol: "$",
			exchangeRate: 1,
			isBase: true,
			isActive: true,
		});
		await ctrl.create({
			code: "EUR",
			name: "Euro",
			symbol: "€",
			exchangeRate: 0.85,
			isBase: false,
			isActive: true,
		});

		const result = await simulateProductPrice(data, {
			productId: "prod_1",
			basePriceInCents: 2000,
			currencyCode: "EUR",
		});

		expect("price" in result).toBe(true);
		if ("price" in result) {
			expect(result.price.currency.code).toBe("EUR");
		}
	});

	it("uses price override when set", async () => {
		const ctrl = createMultiCurrencyController(data);
		await ctrl.create({
			code: "USD",
			name: "US Dollar",
			symbol: "$",
			exchangeRate: 1,
			isBase: true,
			isActive: true,
		});
		await ctrl.create({
			code: "EUR",
			name: "Euro",
			symbol: "€",
			exchangeRate: 0.85,
			isBase: false,
			isActive: true,
		});
		await ctrl.setPriceOverride({
			productId: "prod_1",
			currencyCode: "EUR",
			price: 1599,
		});

		const result = await simulateProductPrice(data, {
			productId: "prod_1",
			basePriceInCents: 2000,
			currencyCode: "EUR",
		});

		expect("price" in result).toBe(true);
		if ("price" in result) {
			expect(result.price.amount).toBe(1599);
		}
	});

	it("returns error for unknown target currency", async () => {
		const ctrl = createMultiCurrencyController(data);
		await ctrl.create({
			code: "USD",
			name: "US Dollar",
			symbol: "$",
			exchangeRate: 1,
			isBase: true,
			isActive: true,
		});

		const result = await simulateProductPrice(data, {
			productId: "prod_1",
			basePriceInCents: 2000,
			currencyCode: "NONE",
		});

		expect(result).toEqual({ error: "Price not available", status: 400 });
	});
});
