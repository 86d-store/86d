import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createMultiCurrencyController } from "../service-impl";

/**
 * Security regression tests for multi-currency endpoints.
 *
 * Multi-currency has store endpoints (convert, format) and admin CRUD.
 * Security focuses on:
 * - Base currency cannot be deleted
 * - Only one base currency at a time
 * - Inactive currencies are filtered from active-only listings
 * - Exchange rate updates on base currency are ignored (always 1)
 * - Cascade deletion removes price overrides and rate history
 * - Price overrides take precedence over conversion
 */

describe("multi-currency endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createMultiCurrencyController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createMultiCurrencyController(mockData);
	});

	describe("base currency protection", () => {
		it("cannot delete the base currency", async () => {
			const usd = await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});

			const result = await controller.delete(usd.id);
			expect(result.deleted).toBe(false);
			expect(result.error).toContain("base currency");
		});

		it("only one base currency exists at a time", async () => {
			const usd = await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});

			const eur = await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "E",
				isBase: true,
			});

			// USD should no longer be base
			const updatedUsd = await controller.getById(usd.id);
			expect(updatedUsd?.isBase).toBe(false);

			// EUR should be base
			const updatedEur = await controller.getById(eur.id);
			expect(updatedEur?.isBase).toBe(true);
		});

		it("setBaseCurrency switches the base", async () => {
			const usd = await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});
			const eur = await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "E",
				exchangeRate: 0.85,
			});

			await controller.setBaseCurrency(eur.id);

			const updatedUsd = await controller.getById(usd.id);
			expect(updatedUsd?.isBase).toBe(false);

			const updatedEur = await controller.getById(eur.id);
			expect(updatedEur?.isBase).toBe(true);
			expect(updatedEur?.exchangeRate).toBe(1);
		});
	});

	describe("inactive currency filtering", () => {
		it("list with activeOnly excludes inactive currencies", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isActive: true,
			});
			await controller.create({
				code: "GBP",
				name: "British Pound",
				symbol: "L",
				isActive: false,
			});

			const active = await controller.list({ activeOnly: true });
			expect(active).toHaveLength(1);
			expect(active[0].code).toBe("USD");
		});

		it("list without activeOnly returns all", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isActive: true,
			});
			await controller.create({
				code: "GBP",
				name: "British Pound",
				symbol: "L",
				isActive: false,
			});

			const all = await controller.list({});
			expect(all).toHaveLength(2);
		});
	});

	describe("exchange rate safety", () => {
		it("updateRate on base currency is a no-op (rate stays 1)", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});

			const result = await controller.updateRate({
				currencyCode: "USD",
				rate: 2.5,
			});

			expect(result?.exchangeRate).toBe(1);
		});

		it("base currency always has exchange rate of 1", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
				exchangeRate: 5, // Should be forced to 1
			});

			const base = await controller.getBaseCurrency();
			expect(base?.exchangeRate).toBe(1);
		});
	});

	describe("cascade deletion", () => {
		it("deleting a currency removes price overrides", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});
			const eur = await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "E",
				exchangeRate: 0.85,
			});

			await controller.setPriceOverride({
				productId: "prod_1",
				currencyCode: "EUR",
				price: 850,
			});

			await controller.delete(eur.id);

			const override = await controller.getPriceOverride("prod_1", "EUR");
			expect(override).toBeNull();
		});

		it("deleting a currency removes rate history", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});
			const eur = await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "E",
				exchangeRate: 0.85,
			});

			await controller.updateRate({ currencyCode: "EUR", rate: 0.9 });
			await controller.updateRate({ currencyCode: "EUR", rate: 0.88 });

			await controller.delete(eur.id);

			const history = await controller.getRateHistory({
				currencyCode: "EUR",
			});
			expect(history).toHaveLength(0);
		});
	});

	describe("price override precedence", () => {
		it("price override takes precedence over conversion", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "E",
				exchangeRate: 0.85,
			});

			// Set a specific price override
			await controller.setPriceOverride({
				productId: "prod_1",
				currencyCode: "EUR",
				price: 999,
			});

			const result = await controller.getProductPrice({
				productId: "prod_1",
				basePriceInCents: 1000,
				currencyCode: "EUR",
			});

			expect(result?.amount).toBe(999);
		});

		it("falls back to conversion when no override exists", async () => {
			await controller.create({
				code: "USD",
				name: "US Dollar",
				symbol: "$",
				isBase: true,
			});
			await controller.create({
				code: "EUR",
				name: "Euro",
				symbol: "E",
				exchangeRate: 0.85,
				decimalPlaces: 2,
			});

			const result = await controller.getProductPrice({
				productId: "prod_no_override",
				basePriceInCents: 1000,
				currencyCode: "EUR",
			});

			expect(result).not.toBeNull();
		});
	});

	describe("conversion safety", () => {
		it("convert returns null for non-existent currency", async () => {
			const result = await controller.convert({
				amount: 100,
				to: "FAKE",
			});
			expect(result).toBeNull();
		});

		it("formatPrice returns null for non-existent currency", async () => {
			const result = await controller.formatPrice(100, "FAKE");
			expect(result).toBeNull();
		});

		it("currency code is normalized to uppercase", async () => {
			await controller.create({
				code: "usd",
				name: "US Dollar",
				symbol: "$",
			});

			const found = await controller.getByCode("USD");
			expect(found).not.toBeNull();
			expect(found?.code).toBe("USD");
		});
	});
});
