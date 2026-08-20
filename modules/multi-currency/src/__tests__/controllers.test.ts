import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createMultiCurrencyController } from "../service-impl";

describe("multi-currency controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createMultiCurrencyController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createMultiCurrencyController(mockData);
	});

	// Helper to create USD as base currency
	async function createBase() {
		return controller.create({
			code: "USD",
			name: "US Dollar",
			symbol: "$",
			isBase: true,
		});
	}

	// ── Code uppercasing ────────────────────────────────────────────

	describe("code uppercasing on create and lookup", () => {
		it("uppercases mixed-case code on create", async () => {
			const currency = await controller.create({
				code: "gBp",
				name: "British Pound",
				symbol: "\u00A3",
			});
			expect(currency.code).toBe("GBP");
		});

		it("getByCode normalizes lowercase input to find stored currency", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});
			const found = await controller.getByCode("eur");
			expect(found?.code).toBe("EUR");
		});

		it("getByCode normalizes mixed-case input", async () => {
			await controller.create({
				code: "JPY",
				name: "Japanese Yen",
				symbol: "\u00A5",
			});
			const found = await controller.getByCode("jPy");
			expect(found?.code).toBe("JPY");
		});
	});

	// ── Base currency rate forced to 1 ──────────────────────────────

	describe("base currency rate forced to 1", () => {
		it("ignores custom exchangeRate when isBase is true", async () => {
			const usd = await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
				exchangeRate: 99.99,
			});
			expect(usd.exchangeRate).toBe(1);
		});

		it("setBaseCurrency resets rate to 1 for the new base", async () => {
			await createBase();
			const eur = await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});

			const result = await controller.setBaseCurrency(eur.id);
			expect(result?.exchangeRate).toBe(1);
			expect(result?.isBase).toBe(true);
		});

		it("updateRate on base currency returns currency unchanged", async () => {
			const usd = await createBase();
			const result = await controller.updateRate({
				currencyCode: "USD",
				rate: 2.5,
			});
			expect(result?.exchangeRate).toBe(1);
			expect(result?.id).toBe(usd.id);
		});

		it("updateRate on base currency does not create history entry", async () => {
			await createBase();
			await controller.updateRate({
				currencyCode: "USD",
				rate: 2.0,
			});
			const history = await controller.getRateHistory({
				currencyCode: "USD",
			});
			expect(history).toHaveLength(0);
		});
	});

	// ── Setting new base unsets old base ─────────────────────────────

	describe("setting new base unsets old base", () => {
		it("create with isBase=true unsets previously created base", async () => {
			const usd = await createBase();
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				isBase: true,
			});

			const updatedUsd = await controller.getById(usd.id);
			expect(updatedUsd?.isBase).toBe(false);
		});

		it("setBaseCurrency unsets the previous base", async () => {
			const usd = await createBase();
			const eur = await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});

			await controller.setBaseCurrency(eur.id);

			const updatedUsd = await controller.getById(usd.id);
			expect(updatedUsd?.isBase).toBe(false);

			const base = await controller.getBaseCurrency();
			expect(base?.code).toBe("EUR");
		});

		it("only one base currency exists after multiple setBaseCurrency calls", async () => {
			const usd = await createBase();
			const eur = await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});
			const gbp = await controller.create({
				code: "GBP",
				name: "Pound",
				symbol: "\u00A3",
			});

			await controller.setBaseCurrency(eur.id);
			await controller.setBaseCurrency(gbp.id);

			const all = await controller.list();
			const bases = all.filter((c) => c.isBase);
			expect(bases).toHaveLength(1);
			expect(bases[0].code).toBe("GBP");

			const updatedUsd = await controller.getById(usd.id);
			expect(updatedUsd?.isBase).toBe(false);
			const updatedEur = await controller.getById(eur.id);
			expect(updatedEur?.isBase).toBe(false);
		});
	});

	// ── Cannot delete base currency ─────────────────────────────────

	describe("cannot delete base currency", () => {
		it("returns error and does not delete when currency is base", async () => {
			const usd = await createBase();
			const result = await controller.delete(usd.id);
			expect(result.deleted).toBe(false);
			expect(result.error).toBe("Cannot delete the base currency");

			const stillExists = await controller.getById(usd.id);
			expect(stillExists).not.toBeNull();
		});

		it("can delete after base is moved to another currency", async () => {
			const usd = await createBase();
			const eur = await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});

			await controller.setBaseCurrency(eur.id);
			const result = await controller.delete(usd.id);
			expect(result.deleted).toBe(true);
		});
	});

	// ── Rounding modes ──────────────────────────────────────────────

	describe("rounding modes: round, ceil, floor", () => {
		it("round mode rounds to nearest", async () => {
			await createBase();
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.8333,
				roundingMode: "round",
			});

			// 100 * 0.8333 = 83.33 (rounds to 83.33 at 2dp)
			const result = await controller.convert({ amount: 100, to: "EUR" });
			expect(result?.amount).toBe(83.33);
		});

		it("ceil mode rounds up", async () => {
			await createBase();
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.8331,
				roundingMode: "ceil",
			});

			// 100 * 0.8331 = 83.31 -> ceil at 2dp = 83.31 (exact)
			// 1 * 0.8331 = 0.8331 -> ceil at 2dp = 0.84
			const result = await controller.convert({ amount: 1, to: "EUR" });
			expect(result?.amount).toBe(0.84);
		});

		it("floor mode rounds down", async () => {
			await createBase();
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.8339,
				roundingMode: "floor",
			});

			// 1 * 0.8339 = 0.8339 -> floor at 2dp = 0.83
			const result = await controller.convert({ amount: 1, to: "EUR" });
			expect(result?.amount).toBe(0.83);
		});

		it("rounding respects zero-decimal currencies", async () => {
			await createBase();
			await controller.create({
				code: "JPY",
				name: "Japanese Yen",
				symbol: "\u00A5",
				exchangeRate: 149.7,
				decimalPlaces: 0,
				roundingMode: "floor",
			});

			// 1 * 149.7 = 149.7 -> floor at 0dp = 149
			const result = await controller.convert({ amount: 1, to: "JPY" });
			expect(result?.amount).toBe(149);
		});

		it("ceil rounding on zero-decimal currency rounds up", async () => {
			await createBase();
			await controller.create({
				code: "JPY",
				name: "Japanese Yen",
				symbol: "\u00A5",
				exchangeRate: 149.1,
				decimalPlaces: 0,
				roundingMode: "ceil",
			});

			// 1 * 149.1 = 149.1 -> ceil at 0dp = 150
			const result = await controller.convert({ amount: 1, to: "JPY" });
			expect(result?.amount).toBe(150);
		});
	});

	// ── Cross-currency conversion ───────────────────────────────────

	describe("cross-currency conversion (non-base to non-base via base)", () => {
		it("converts EUR to GBP through USD base", async () => {
			await createBase();
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});
			await controller.create({
				code: "GBP",
				name: "British Pound",
				symbol: "\u00A3",
				exchangeRate: 0.75,
			});

			// 100 EUR -> USD: 100 / 0.85 = 117.647...
			// USD -> GBP: 117.647... * 0.75 = 88.235...
			// round at 2dp = 88.24
			const result = await controller.convert({
				amount: 100,
				from: "EUR",
				to: "GBP",
			});
			expect(result?.amount).toBeCloseTo(88.24, 1);
		});

		it("cross-currency conversion returns null for unknown source", async () => {
			await createBase();
			await controller.create({
				code: "GBP",
				name: "British Pound",
				symbol: "\u00A3",
				exchangeRate: 0.75,
			});

			const result = await controller.convert({
				amount: 100,
				from: "FAKE",
				to: "GBP",
			});
			expect(result).toBeNull();
		});

		it("cross-currency conversion returns null for unknown target", async () => {
			await createBase();
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});

			const result = await controller.convert({
				amount: 100,
				from: "EUR",
				to: "FAKE",
			});
			expect(result).toBeNull();
		});

		it("converting from base to non-base uses direct multiplication", async () => {
			await createBase();
			await controller.create({
				code: "CAD",
				name: "Canadian Dollar",
				symbol: "CA$",
				exchangeRate: 1.35,
			});

			// 100 USD -> CAD = 100 * 1.35 = 135.00
			const result = await controller.convert({ amount: 100, to: "CAD" });
			expect(result?.amount).toBe(135);
		});
	});

	// ── Format with symbol position ─────────────────────────────────

	describe("formatPrice with symbol position (before/after)", () => {
		it("formats with symbol before and US separators", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				symbolPosition: "before",
				thousandsSeparator: ",",
				decimalSeparator: ".",
			});

			const result = await controller.formatPrice(1234567.89, "USD");
			expect(result).toBe("$1,234,567.89");
		});

		it("formats with symbol after and European separators", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: " \u20AC",
				symbolPosition: "after",
				thousandsSeparator: ".",
				decimalSeparator: ",",
			});

			const result = await controller.formatPrice(1234.56, "EUR");
			expect(result).toBe("1.234,56 \u20AC");
		});

		it("formats zero-decimal currency without decimal part", async () => {
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

		it("formatPrice returns null for unknown currency code", async () => {
			const result = await controller.formatPrice(100, "NOPE");
			expect(result).toBeNull();
		});

		it("converted result includes formatted string", async () => {
			await createBase();
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
				symbolPosition: "after",
				thousandsSeparator: ".",
				decimalSeparator: ",",
			});

			const result = await controller.convert({
				amount: 1000,
				to: "EUR",
			});
			// 1000 * 0.85 = 850.00
			expect(result?.formatted).toBe("850,00\u20AC");
		});
	});

	// ── Price override takes priority in getProductPrice ────────────

	describe("price override takes priority in getProductPrice", () => {
		it("returns override price instead of converted price", async () => {
			await createBase();
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});

			await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "EUR",
				price: 7777,
			});

			const result = await controller.getProductPrice({
				productId: "prod-1",
				basePriceInCents: 10000,
				currencyCode: "EUR",
			});

			// Override price (7777) should be used, not converted (8500)
			expect(result?.amount).toBe(7777);
		});

		it("falls back to conversion when override is deleted", async () => {
			await createBase();
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});

			const override = await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "EUR",
				price: 7777,
			});

			await controller.deletePriceOverride(override.id);

			const result = await controller.getProductPrice({
				productId: "prod-1",
				basePriceInCents: 10000,
				currencyCode: "EUR",
			});

			// Should now use conversion: 100.00 * 0.85 = 85.00 = 8500 cents
			expect(result?.amount).toBe(8500);
		});

		it("different products can have different overrides for same currency", async () => {
			await createBase();
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});

			await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "EUR",
				price: 5000,
			});
			await controller.setPriceOverride({
				productId: "prod-2",
				currencyCode: "EUR",
				price: 9999,
			});

			const result1 = await controller.getProductPrice({
				productId: "prod-1",
				basePriceInCents: 10000,
				currencyCode: "EUR",
			});
			const result2 = await controller.getProductPrice({
				productId: "prod-2",
				basePriceInCents: 10000,
				currencyCode: "EUR",
			});

			expect(result1?.amount).toBe(5000);
			expect(result2?.amount).toBe(9999);
		});
	});

	// ── Rate history recording on updateRate ────────────────────────

	describe("rate history recording on updateRate", () => {
		it("records a history entry for each rate update", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});

			await controller.updateRate({
				currencyCode: "EUR",
				rate: 0.86,
				source: "api",
			});
			await controller.updateRate({
				currencyCode: "EUR",
				rate: 0.87,
				source: "manual",
			});
			await controller.updateRate({
				currencyCode: "EUR",
				rate: 0.88,
				source: "openexchangerates",
			});

			const history = await controller.getRateHistory({
				currencyCode: "EUR",
			});
			expect(history).toHaveLength(3);

			const sources = history.map((h) => h.source).sort();
			expect(sources).toEqual(["api", "manual", "openexchangerates"]);
		});

		it("defaults source to manual when not specified", async () => {
			await controller.create({
				code: "GBP",
				name: "Pound",
				symbol: "\u00A3",
			});

			await controller.updateRate({
				currencyCode: "GBP",
				rate: 0.78,
			});

			const history = await controller.getRateHistory({
				currencyCode: "GBP",
			});
			expect(history[0].source).toBe("manual");
		});

		it("history is isolated per currency code", async () => {
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

			await controller.updateRate({ currencyCode: "EUR", rate: 0.9 });
			await controller.updateRate({ currencyCode: "EUR", rate: 0.91 });
			await controller.updateRate({ currencyCode: "GBP", rate: 0.78 });

			const eurHistory = await controller.getRateHistory({
				currencyCode: "EUR",
			});
			const gbpHistory = await controller.getRateHistory({
				currencyCode: "GBP",
			});

			expect(eurHistory).toHaveLength(2);
			expect(gbpHistory).toHaveLength(1);
		});

		it("getRateHistory respects limit parameter", async () => {
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

			const limited = await controller.getRateHistory({
				currencyCode: "EUR",
				limit: 3,
			});
			expect(limited).toHaveLength(3);
		});
	});

	// ── bulkUpdateRates with mix of valid/invalid ───────────────────

	describe("bulkUpdateRates with mix of valid/invalid currencies", () => {
		it("updates valid currencies and reports errors for invalid ones", async () => {
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
				{ currencyCode: "FAKE", rate: 1.5 },
				{ currencyCode: "GBP", rate: 0.78 },
				{ currencyCode: "NOPE", rate: 2.0 },
			]);

			expect(result.updated).toBe(2);
			expect(result.errors).toHaveLength(2);
			expect(result.errors).toContain("Currency not found: FAKE");
			expect(result.errors).toContain("Currency not found: NOPE");
		});

		it("counts base currency as updated even though rate is unchanged", async () => {
			await createBase();
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});

			const result = await controller.bulkUpdateRates([
				{ currencyCode: "USD", rate: 2.0 },
				{ currencyCode: "EUR", rate: 0.9 },
			]);

			// Base currency returns the currency (unchanged), so it counts as updated
			expect(result.updated).toBe(2);
			expect(result.errors).toHaveLength(0);

			// But base currency rate should still be 1
			const base = await controller.getByCode("USD");
			expect(base?.exchangeRate).toBe(1);
		});

		it("empty rates array returns zero updated and no errors", async () => {
			const result = await controller.bulkUpdateRates([]);
			expect(result.updated).toBe(0);
			expect(result.errors).toHaveLength(0);
		});
	});

	// ── Delete cascades to overrides and history ─────────────────────

	describe("delete cascades to overrides and history", () => {
		it("deleting a currency removes its price overrides", async () => {
			const eur = await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});

			await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "EUR",
				price: 8500,
			});
			await controller.setPriceOverride({
				productId: "prod-2",
				currencyCode: "EUR",
				price: 9000,
			});

			await controller.delete(eur.id);

			const overrides1 = await controller.listPriceOverrides("prod-1");
			const overrides2 = await controller.listPriceOverrides("prod-2");
			expect(overrides1).toHaveLength(0);
			expect(overrides2).toHaveLength(0);
		});

		it("deleting a currency removes its rate history", async () => {
			const eur = await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});

			await controller.updateRate({ currencyCode: "EUR", rate: 0.86 });
			await controller.updateRate({ currencyCode: "EUR", rate: 0.87 });
			await controller.updateRate({ currencyCode: "EUR", rate: 0.88 });

			await controller.delete(eur.id);

			const history = await controller.getRateHistory({
				currencyCode: "EUR",
			});
			expect(history).toHaveLength(0);
		});

		it("deleting one currency does not affect another currency's data", async () => {
			const eur = await controller.create({
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
			await controller.updateRate({ currencyCode: "EUR", rate: 0.9 });
			await controller.updateRate({ currencyCode: "GBP", rate: 0.78 });

			await controller.delete(eur.id);

			// GBP data should be untouched
			const gbpOverrides = await controller.getPriceOverride("prod-1", "GBP");
			expect(gbpOverrides?.price).toBe(7500);

			const gbpHistory = await controller.getRateHistory({
				currencyCode: "GBP",
			});
			expect(gbpHistory).toHaveLength(1);
		});
	});

	// ── Cross-method interactions ───────────────────────────────────

	describe("cross-method interactions", () => {
		it("updating exchange rate changes subsequent conversions", async () => {
			await createBase();
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});

			const before = await controller.convert({ amount: 100, to: "EUR" });
			expect(before?.amount).toBe(85);

			await controller.updateRate({ currencyCode: "EUR", rate: 0.92 });

			const after = await controller.convert({ amount: 100, to: "EUR" });
			expect(after?.amount).toBe(92);
		});

		it("setPriceOverride uppercases currency code for matching", async () => {
			await createBase();
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				exchangeRate: 0.85,
			});

			await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "eur",
				price: 5000,
			});

			const override = await controller.getPriceOverride("prod-1", "EUR");
			expect(override?.price).toBe(5000);
		});

		it("list returns currencies sorted by sortOrder", async () => {
			await controller.create({
				code: "GBP",
				name: "Pound",
				symbol: "\u00A3",
				sortOrder: 3,
			});
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				sortOrder: 1,
			});
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
				sortOrder: 2,
			});

			const all = await controller.list();
			expect(all[0].code).toBe("USD");
			expect(all[1].code).toBe("EUR");
			expect(all[2].code).toBe("GBP");
		});

		it("list with activeOnly filters inactive currencies", async () => {
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
			await controller.create({
				code: "GBP",
				name: "Pound",
				symbol: "\u00A3",
				isActive: true,
			});

			const active = await controller.list({ activeOnly: true });
			expect(active).toHaveLength(2);
			const codes = active.map((c) => c.code).sort();
			expect(codes).toEqual(["GBP", "USD"]);
		});

		it("update returns null for nonexistent currency", async () => {
			const result = await controller.update("nonexistent", {
				name: "Test",
			});
			expect(result).toBeNull();
		});

		it("delete returns error for nonexistent currency", async () => {
			const result = await controller.delete("nonexistent");
			expect(result.deleted).toBe(false);
			expect(result.error).toBe("Currency not found");
		});

		it("getProductPrice returns null when no base currency is set", async () => {
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

		it("setPriceOverride updates existing override for same product+currency", async () => {
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "\u20AC",
			});

			const first = await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "EUR",
				price: 8000,
			});
			const second = await controller.setPriceOverride({
				productId: "prod-1",
				currencyCode: "EUR",
				price: 9000,
			});

			expect(second.id).toBe(first.id);
			expect(second.price).toBe(9000);

			const overrides = await controller.listPriceOverrides("prod-1");
			expect(overrides).toHaveLength(1);
		});
	});
});
