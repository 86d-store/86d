import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MultiCurrencyController } from "../service";
import { createMultiCurrencyController } from "../service-impl";

function createMockEvents(): ScopedEventEmitter & {
	emitted: Array<{ type: string; payload: unknown }>;
} {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	return {
		emitted,
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn(() => () => {}),
		off: vi.fn(),
	};
}

describe("createMultiCurrencyController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let mockEvents: ReturnType<typeof createMockEvents>;
	let controller: MultiCurrencyController;

	beforeEach(() => {
		mockData = createMockDataService();
		mockEvents = createMockEvents();
		controller = createMultiCurrencyController(mockData, mockEvents);
	});

	// --- Currency CRUD ---

	describe("create", () => {
		it("creates a currency with defaults", async () => {
			const currency = await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
			});

			expect(currency.code).toBe("USD");
			expect(currency.name).toBe("US Dollar");
			expect(currency.symbol).toBe("$");
			expect(currency.decimalPlaces).toBe(2);
			expect(currency.exchangeRate).toBe(1);
			expect(currency.isBase).toBe(false);
			expect(currency.isActive).toBe(true);
			expect(currency.symbolPosition).toBe("before");
			expect(currency.thousandsSeparator).toBe(",");
			expect(currency.decimalSeparator).toBe(".");
			expect(currency.roundingMode).toBe("round");
			expect(currency.id).toBeTruthy();
			expect(currency.createdAt).toBeInstanceOf(Date);
		});

		it("uppercases the currency code", async () => {
			const currency = await controller.create({
				code: "eur",
				name: "Euro",
				symbol: "\u20AC",
			});
			expect(currency.code).toBe("EUR");
		});

		it("creates a base currency with rate=1", async () => {
			const currency = await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
				exchangeRate: 5, // Should be overridden to 1
			});
			expect(currency.isBase).toBe(true);
			expect(currency.exchangeRate).toBe(1);
		});

		it("unsets existing base when creating a new base", async () => {
			const usd = await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});

			const eur = await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				isBase: true,
			});

			const updatedUsd = await controller.getById(usd.id);
			expect(updatedUsd?.isBase).toBe(false);
			expect(eur.isBase).toBe(true);
		});

		it("emits currency.created event", async () => {
			const currency = await controller.create({
				code: "GBP",
				name: "British Pound",
				symbol: "\u00A3",
			});
			expect(mockEvents.emitted).toContainEqual({
				type: "currency.created",
				payload: { id: currency.id, code: "GBP" },
			});
		});

		it("creates currency with custom formatting", async () => {
			const currency = await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				symbolPosition: "after",
				thousandsSeparator: ".",
				decimalSeparator: ",",
			});
			expect(currency.symbolPosition).toBe("after");
			expect(currency.thousandsSeparator).toBe(".");
			expect(currency.decimalSeparator).toBe(",");
		});

		it("creates zero-decimal currency", async () => {
			const currency = await controller.create({
				code: "JPY",
				name: "Japanese Yen",
				symbol: "\u00A5",
				decimalPlaces: 0,
			});
			expect(currency.decimalPlaces).toBe(0);
		});
	});

	describe("getById", () => {
		it("returns currency by ID", async () => {
			const created = await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
			});
			const found = await controller.getById(created.id);
			expect(found?.code).toBe("USD");
		});

		it("returns null for nonexistent ID", async () => {
			const result = await controller.getById("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("getByCode", () => {
		it("returns currency by code", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
			});
			const found = await controller.getByCode("USD");
			expect(found?.name).toBe("US Dollar");
		});

		it("is case-insensitive", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
			});
			const found = await controller.getByCode("usd");
			expect(found?.name).toBe("US Dollar");
		});

		it("returns null for unknown code", async () => {
			const result = await controller.getByCode("XYZ");
			expect(result).toBeNull();
		});
	});

	describe("update", () => {
		it("updates currency fields", async () => {
			const created = await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
			});
			const updated = await controller.update(created.id, {
				name: "United States Dollar",
				exchangeRate: 1.5,
			});
			expect(updated?.name).toBe("United States Dollar");
			expect(updated?.exchangeRate).toBe(1.5);
			expect(updated?.symbol).toBe("$"); // Unchanged
		});

		it("returns null for nonexistent currency", async () => {
			const result = await controller.update("fake", { name: "Test" });
			expect(result).toBeNull();
		});

		it("emits currency.updated event", async () => {
			const created = await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
			});
			await controller.update(created.id, { name: "Updated" });
			expect(mockEvents.emitted).toContainEqual({
				type: "currency.updated",
				payload: { id: created.id, code: "USD" },
			});
		});
	});

	describe("delete", () => {
		it("deletes a non-base currency", async () => {
			const currency = await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});
			const result = await controller.delete(currency.id);
			expect(result.deleted).toBe(true);
			expect(await controller.getById(currency.id)).toBeNull();
		});

		it("cannot delete the base currency", async () => {
			const currency = await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});
			const result = await controller.delete(currency.id);
			expect(result.deleted).toBe(false);
			expect(result.error).toBe("Cannot delete the base currency");
		});

		it("returns error for nonexistent currency", async () => {
			const result = await controller.delete("fake");
			expect(result.deleted).toBe(false);
			expect(result.error).toBe("Currency not found");
		});

		it("deletes associated price overrides", async () => {
			const currency = await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});
			await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "EUR",
				price: 1000,
			});
			await controller.delete(currency.id);
			const overrides = await controller.listPriceOverrides("prod-1");
			expect(overrides).toHaveLength(0);
		});

		it("deletes associated rate history", async () => {
			const currency = await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});
			await controller.updateRate({
				currencyCode: "EUR",
				rate: 0.9,
			});
			await controller.delete(currency.id);
			const history = await controller.getRateHistory({
				currencyCode: "EUR",
			});
			expect(history).toHaveLength(0);
		});

		it("emits currency.deleted event", async () => {
			const currency = await controller.create({
				code: "GBP",
				name: "Pound",
				symbol: "\u00A3",
			});
			await controller.delete(currency.id);
			expect(mockEvents.emitted).toContainEqual({
				type: "currency.deleted",
				payload: { id: currency.id, code: "GBP" },
			});
		});
	});

	describe("list", () => {
		it("lists all currencies sorted by sortOrder", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				sortOrder: 2,
			});
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				sortOrder: 1,
			});
			await controller.create({
				code: "GBP",
				name: "Pound",
				symbol: "\u00A3",
				sortOrder: 3,
			});

			const currencies = await controller.list();
			expect(currencies).toHaveLength(3);
			expect(currencies[0].code).toBe("USD");
			expect(currencies[1].code).toBe("EUR");
			expect(currencies[2].code).toBe("GBP");
		});

		it("filters active-only currencies", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isActive: true,
			});
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				isActive: false,
			});

			const active = await controller.list({ activeOnly: true });
			expect(active).toHaveLength(1);
			expect(active[0].code).toBe("USD");
		});
	});

	// --- Base Currency ---

	describe("getBaseCurrency", () => {
		it("returns the base currency", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});
			const base = await controller.getBaseCurrency();
			expect(base?.code).toBe("USD");
		});

		it("returns null when no base set", async () => {
			const result = await controller.getBaseCurrency();
			expect(result).toBeNull();
		});
	});

	describe("setBaseCurrency", () => {
		it("sets a currency as base", async () => {
			const usd = await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});
			const eur = await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});

			const result = await controller.setBaseCurrency(eur.id);
			expect(result?.isBase).toBe(true);
			expect(result?.exchangeRate).toBe(1);

			const updatedUsd = await controller.getById(usd.id);
			expect(updatedUsd?.isBase).toBe(false);
		});

		it("returns null for nonexistent currency", async () => {
			const result = await controller.setBaseCurrency("fake");
			expect(result).toBeNull();
		});

		it("emits currency.baseChanged event", async () => {
			const usd = await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
			});
			await controller.setBaseCurrency(usd.id);
			expect(mockEvents.emitted).toContainEqual({
				type: "currency.baseChanged",
				payload: { id: usd.id, code: "USD" },
			});
		});
	});

	// --- Exchange Rates ---

	describe("updateRate", () => {
		it("updates the exchange rate and records history", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});

			const updated = await controller.updateRate({
				currencyCode: "EUR",
				rate: 0.9,
				source: "api",
			});

			expect(updated?.exchangeRate).toBe(0.9);

			const history = await controller.getRateHistory({
				currencyCode: "EUR",
			});
			expect(history).toHaveLength(1);
			expect(history[0].rate).toBe(0.9);
			expect(history[0].source).toBe("api");
		});

		it("does not update the base currency rate", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});

			const result = await controller.updateRate({
				currencyCode: "USD",
				rate: 2.0,
			});
			expect(result?.exchangeRate).toBe(1); // Unchanged
		});

		it("returns null for unknown currency", async () => {
			const result = await controller.updateRate({
				currencyCode: "XYZ",
				rate: 1.5,
			});
			expect(result).toBeNull();
		});

		it("emits currency.rateUpdated event", async () => {
			await controller.create({
				code: "GBP",
				name: "Pound",
				symbol: "\u00A3",
				exchangeRate: 0.75,
			});
			await controller.updateRate({
				currencyCode: "GBP",
				rate: 0.8,
			});
			expect(mockEvents.emitted).toContainEqual({
				type: "currency.rateUpdated",
				payload: {
					code: "GBP",
					oldRate: 0.75,
					newRate: 0.8,
					source: "manual",
				},
			});
		});

		it("defaults source to manual", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});
			await controller.updateRate({
				currencyCode: "EUR",
				rate: 0.9,
			});
			const history = await controller.getRateHistory({
				currencyCode: "EUR",
			});
			expect(history[0].source).toBe("manual");
		});
	});

	describe("bulkUpdateRates", () => {
		it("updates multiple rates", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});
			await controller.create({
				code: "GBP",
				name: "Pound",
				symbol: "\u00A3",
			});

			const result = await controller.bulkUpdateRates([
				{ currencyCode: "EUR", rate: 0.9 },
				{ currencyCode: "GBP", rate: 0.78 },
			]);

			expect(result.updated).toBe(2);
			expect(result.errors).toHaveLength(0);
		});

		it("reports errors for unknown currencies", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});

			const result = await controller.bulkUpdateRates([
				{ currencyCode: "EUR", rate: 0.9 },
				{ currencyCode: "XYZ", rate: 1.5 },
			]);

			expect(result.updated).toBe(1);
			expect(result.errors).toEqual(["Currency not found: XYZ"]);
		});
	});

	describe("getRateHistory", () => {
		it("returns history entries for the currency", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});
			await controller.updateRate({
				currencyCode: "EUR",
				rate: 0.85,
			});
			await controller.updateRate({
				currencyCode: "EUR",
				rate: 0.9,
			});
			await controller.updateRate({
				currencyCode: "EUR",
				rate: 0.88,
			});

			const history = await controller.getRateHistory({
				currencyCode: "EUR",
			});
			expect(history).toHaveLength(3);
			const rates = history.map((h) => h.rate).sort();
			expect(rates).toEqual([0.85, 0.88, 0.9]);
		});

		it("respects limit parameter", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});
			for (let i = 0; i < 10; i++) {
				await controller.updateRate({
					currencyCode: "EUR",
					rate: 0.8 + i * 0.01,
				});
			}

			const history = await controller.getRateHistory({
				currencyCode: "EUR",
				limit: 3,
			});
			expect(history).toHaveLength(3);
		});
	});

	// --- Price Conversion ---

	describe("convert", () => {
		it("converts from base to target currency", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});

			const result = await controller.convert({
				amount: 100,
				to: "EUR",
			});

			expect(result).not.toBeNull();
			expect(result?.amount).toBe(85);
		});

		it("converts between two non-base currencies", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});
			await controller.create({
				code: "GBP",
				name: "Pound",
				symbol: "\u00A3",
				exchangeRate: 0.75,
			});

			// 100 EUR -> USD -> GBP
			// 100 / 0.85 = 117.647 USD
			// 117.647 * 0.75 = 88.24 GBP
			const result = await controller.convert({
				amount: 100,
				from: "EUR",
				to: "GBP",
			});

			expect(result).not.toBeNull();
			expect(result?.amount).toBeCloseTo(88.24, 1);
		});

		it("returns null for unknown target currency", async () => {
			const result = await controller.convert({
				amount: 100,
				to: "XYZ",
			});
			expect(result).toBeNull();
		});

		it("returns null for unknown source currency", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});
			const result = await controller.convert({
				amount: 100,
				from: "XYZ",
				to: "EUR",
			});
			expect(result).toBeNull();
		});

		it("applies ceiling rounding mode", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.333,
				roundingMode: "ceil",
			});

			// 1 * 0.333 = 0.333, ceil at 2 decimal places = 0.34
			const result = await controller.convert({
				amount: 1,
				to: "EUR",
			});
			expect(result?.amount).toBe(0.34);
		});

		it("applies floor rounding mode", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.337,
				roundingMode: "floor",
			});

			const result = await controller.convert({
				amount: 100,
				to: "EUR",
			});
			expect(result?.amount).toBe(33.7); // floor at 2 decimal places
		});

		it("handles zero-decimal currency conversion", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});
			await controller.create({
				code: "JPY",
				name: "Japanese Yen",
				symbol: "\u00A5",
				exchangeRate: 149.5,
				decimalPlaces: 0,
			});

			const result = await controller.convert({
				amount: 100,
				to: "JPY",
			});
			expect(result?.amount).toBe(14950);
		});
	});

	// --- Price Formatting ---

	describe("formatPrice", () => {
		it("formats with symbol before", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				symbolPosition: "before",
			});

			const result = await controller.formatPrice(1234.56, "USD");
			expect(result).toBe("$1,234.56");
		});

		it("formats with symbol after", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				symbolPosition: "after",
				thousandsSeparator: ".",
				decimalSeparator: ",",
			});

			const result = await controller.formatPrice(1234.56, "EUR");
			expect(result).toBe("1.234,56\u20AC");
		});

		it("formats zero-decimal currency", async () => {
			await controller.create({
				code: "JPY",
				name: "Japanese Yen",
				symbol: "\u00A5",
				decimalPlaces: 0,
				symbolPosition: "before",
			});

			const result = await controller.formatPrice(14950, "JPY");
			expect(result).toBe("\u00A514,950");
		});

		it("returns null for unknown currency", async () => {
			const result = await controller.formatPrice(100, "XYZ");
			expect(result).toBeNull();
		});

		it("formats large numbers with thousands separators", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
			});

			const result = await controller.formatPrice(1234567.89, "USD");
			expect(result).toBe("$1,234,567.89");
		});
	});

	// --- Price Overrides ---

	describe("setPriceOverride", () => {
		it("creates a price override", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});

			const override = await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "EUR",
				price: 8500,
			});

			expect(override.productId).toBe("prod-1");
			expect(override.currencyCode).toBe("EUR");
			expect(override.price).toBe(8500);
		});

		it("updates existing override for same product+currency", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});

			const first = await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "EUR",
				price: 8500,
			});

			const second = await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "EUR",
				price: 9000,
			});

			expect(second.id).toBe(first.id);
			expect(second.price).toBe(9000);
		});

		it("sets compare-at price", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});

			const override = await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "EUR",
				price: 8500,
				compareAtPrice: 10000,
			});

			expect(override.compareAtPrice).toBe(10000);
		});
	});

	describe("getPriceOverride", () => {
		it("returns override for product+currency", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});
			await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "EUR",
				price: 8500,
			});

			const override = await controller.getPriceOverride("prod-1", "EUR");
			expect(override?.price).toBe(8500);
		});

		it("returns null when no override exists", async () => {
			const result = await controller.getPriceOverride("prod-1", "EUR");
			expect(result).toBeNull();
		});
	});

	describe("listPriceOverrides", () => {
		it("lists all overrides for a product", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});
			await controller.create({
				code: "GBP",
				name: "Pound",
				symbol: "\u00A3",
			});

			await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "EUR",
				price: 8500,
			});
			await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "GBP",
				price: 7500,
			});

			const overrides = await controller.listPriceOverrides("prod-1");
			expect(overrides).toHaveLength(2);
		});
	});

	describe("deletePriceOverride", () => {
		it("deletes a price override", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});
			const override = await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "EUR",
				price: 8500,
			});

			await controller.deletePriceOverride(override.id);

			const found = await controller.getPriceOverride("prod-1", "EUR");
			expect(found).toBeNull();
		});
	});

	// --- Product Price Resolution ---

	describe("getProductPrice", () => {
		it("uses price override when available", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});

			await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "EUR",
				price: 9000, // 90.00 EUR
			});

			const result = await controller.getProductPrice({
				productId: "prod-1",
				basePriceInCents: 10000,
				currencyCode: "EUR",
			});

			expect(result).not.toBeNull();
			expect(result?.amount).toBe(9000);
		});

		it("falls back to conversion when no override", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});

			const result = await controller.getProductPrice({
				productId: "prod-1",
				basePriceInCents: 10000,
				currencyCode: "EUR",
			});

			expect(result).not.toBeNull();
			expect(result?.amount).toBe(8500); // 100.00 * 0.85 = 85.00 = 8500 cents
		});

		it("returns null for unknown currency", async () => {
			const result = await controller.getProductPrice({
				productId: "prod-1",
				basePriceInCents: 10000,
				currencyCode: "XYZ",
			});
			expect(result).toBeNull();
		});

		it("returns null when no base currency is set", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});

			const result = await controller.getProductPrice({
				productId: "prod-1",
				basePriceInCents: 10000,
				currencyCode: "EUR",
			});

			expect(result).toBeNull();
		});

		it("returns formatted price string", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
				symbolPosition: "after",
				thousandsSeparator: ".",
				decimalSeparator: ",",
			});

			const result = await controller.getProductPrice({
				productId: "prod-1",
				basePriceInCents: 10000,
				currencyCode: "EUR",
			});

			expect(result?.formatted).toBe("85,00\u20AC");
		});
	});

	// --- Controller without events ---

	describe("without events", () => {
		it("works without event emitter", async () => {
			const noEventsController = createMultiCurrencyController(mockData);

			const currency = await noEventsController.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
			});

			expect(currency.code).toBe("USD");
		});
	});
});
