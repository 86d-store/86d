import { describe, expect, it, vi } from "vitest";
import { adminBulkUpdateRates } from "../admin/endpoints/bulk-update-rates";
import { adminCreateCurrency } from "../admin/endpoints/create-currency";
import { adminDeleteCurrency } from "../admin/endpoints/delete-currency";
import { adminDeletePriceOverride } from "../admin/endpoints/delete-price-override";
import { adminGetCurrency } from "../admin/endpoints/get-currency";
import { adminListCurrencies } from "../admin/endpoints/list-currencies";
import { adminListPriceOverrides } from "../admin/endpoints/list-price-overrides";
import { adminRateHistory } from "../admin/endpoints/rate-history";
import { adminSetBaseCurrency } from "../admin/endpoints/set-base-currency";
import { adminSetPriceOverride } from "../admin/endpoints/set-price-override";
import { adminUpdateCurrency } from "../admin/endpoints/update-currency";
import { adminUpdateRate } from "../admin/endpoints/update-rate";
import type {
	Currency,
	ExchangeRateHistory,
	MultiCurrencyController,
	PriceOverride,
	RoundingMode,
	SymbolPosition,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeCurrency(overrides: Partial<Currency> = {}): Currency {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		code: "USD",
		name: "US Dollar",
		symbol: "$",
		decimalPlaces: 2,
		exchangeRate: 1,
		isBase: true,
		isActive: true,
		symbolPosition: "before" satisfies SymbolPosition,
		thousandsSeparator: ",",
		decimalSeparator: ".",
		roundingMode: "round" satisfies RoundingMode,
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeHistory(
	overrides: Partial<ExchangeRateHistory> = {},
): ExchangeRateHistory {
	return {
		id: crypto.randomUUID(),
		currencyCode: "EUR",
		rate: 0.85,
		source: "manual",
		recordedAt: new Date(),
		...overrides,
	};
}

function makeOverride(overrides: Partial<PriceOverride> = {}): PriceOverride {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		productId: "prod_1",
		currencyCode: "EUR",
		price: 1599,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<MultiCurrencyController> = {},
): MultiCurrencyController {
	return {
		create: vi.fn().mockResolvedValue(makeCurrency()),
		getById: vi.fn().mockResolvedValue(null),
		getByCode: vi.fn().mockResolvedValue(null),
		update: vi.fn().mockResolvedValue(null),
		delete: vi.fn().mockResolvedValue({ deleted: true }),
		list: vi.fn().mockResolvedValue([]),
		getBaseCurrency: vi.fn().mockResolvedValue(null),
		setBaseCurrency: vi.fn().mockResolvedValue(null),
		updateRate: vi.fn().mockResolvedValue(null),
		bulkUpdateRates: vi.fn().mockResolvedValue({
			updated: 0,
			errors: [],
		} satisfies {
			updated: number;
			errors: string[];
		}),
		getRateHistory: vi.fn().mockResolvedValue([]),
		convert: vi.fn().mockResolvedValue(null),
		formatPrice: vi.fn().mockResolvedValue(null),
		setPriceOverride: vi.fn().mockResolvedValue(makeOverride()),
		getPriceOverride: vi.fn().mockResolvedValue(null),
		listPriceOverrides: vi.fn().mockResolvedValue([]),
		deletePriceOverride: vi.fn().mockResolvedValue(undefined),
		getProductPrice: vi.fn().mockResolvedValue(null),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: MultiCurrencyController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { multiCurrency: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const bulkUpdateRatesHandler = extractHandler(adminBulkUpdateRates);
const createCurrencyHandler = extractHandler(adminCreateCurrency);
const deleteCurrencyHandler = extractHandler(adminDeleteCurrency);
const deletePriceOverrideHandler = extractHandler(adminDeletePriceOverride);
const getCurrencyHandler = extractHandler(adminGetCurrency);
const listCurrenciesHandler = extractHandler(adminListCurrencies);
const listPriceOverridesHandler = extractHandler(adminListPriceOverrides);
const rateHistoryHandler = extractHandler(adminRateHistory);
const setBaseCurrencyHandler = extractHandler(adminSetBaseCurrency);
const setPriceOverrideHandler = extractHandler(adminSetPriceOverride);
const updateCurrencyHandler = extractHandler(adminUpdateCurrency);
const updateRateHandler = extractHandler(adminUpdateRate);

// ── adminListCurrencies ───────────────────────────────────────────────────────

describe("admin GET /currencies", () => {
	it("returns empty array when no currencies configured", async () => {
		const result = (await call(listCurrenciesHandler)) as {
			currencies: Currency[];
		};
		expect(result.currencies).toHaveLength(0);
	});

	it("returns all currencies from controller", async () => {
		const currencies = [
			makeCurrency({ code: "USD", isBase: true }),
			makeCurrency({ code: "EUR", isBase: false }),
		];
		const ctrl = makeController({
			list: vi.fn().mockResolvedValue(currencies),
		});
		const result = (await call(listCurrenciesHandler, {
			controller: ctrl,
		})) as { currencies: Currency[] };
		expect(result.currencies).toHaveLength(2);
		expect(result.currencies[0].code).toBe("USD");
		expect(result.currencies[1].code).toBe("EUR");
		expect(ctrl.list).toHaveBeenCalled();
	});
});

// ── adminCreateCurrency ───────────────────────────────────────────────────────

describe("admin POST /currencies/create", () => {
	it("creates a new currency and returns it", async () => {
		const currency = makeCurrency({ code: "EUR", name: "Euro", symbol: "€" });
		const ctrl = makeController({
			getByCode: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue(currency),
		});
		const result = (await call(createCurrencyHandler, {
			body: { code: "EUR", name: "Euro", symbol: "€" },
			controller: ctrl,
		})) as { currency: Currency };
		expect(result.currency.code).toBe("EUR");
		expect(result.currency.name).toBe("Euro");
		expect(ctrl.create).toHaveBeenCalledWith(
			expect.objectContaining({ code: "EUR", name: "Euro", symbol: "€" }),
		);
	});

	it("returns 409 when currency code already exists", async () => {
		const existing = makeCurrency({ code: "USD" });
		const ctrl = makeController({
			getByCode: vi.fn().mockResolvedValue(existing),
		});
		const result = (await call(createCurrencyHandler, {
			body: { code: "USD", name: "US Dollar", symbol: "$" },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(409);
		expect(result.error).toMatch(/already exists/i);
		expect(ctrl.create).not.toHaveBeenCalled();
	});

	it("uppercases the currency code before checking duplicates", async () => {
		const ctrl = makeController({
			getByCode: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue(makeCurrency({ code: "GBP" })),
		});
		await call(createCurrencyHandler, {
			body: { code: "gbp", name: "British Pound", symbol: "£" },
			controller: ctrl,
		});
		expect(ctrl.getByCode).toHaveBeenCalledWith("GBP");
	});

	it("passes optional fields to controller", async () => {
		const ctrl = makeController({
			getByCode: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue(makeCurrency()),
		});
		await call(createCurrencyHandler, {
			body: {
				code: "JPY",
				name: "Japanese Yen",
				symbol: "¥",
				decimalPlaces: 0,
				exchangeRate: 150.5,
				isBase: false,
				isActive: true,
				symbolPosition: "before",
				roundingMode: "round",
				sortOrder: 1,
			},
			controller: ctrl,
		});
		expect(ctrl.create).toHaveBeenCalledWith(
			expect.objectContaining({
				decimalPlaces: 0,
				exchangeRate: 150.5,
				isBase: false,
				sortOrder: 1,
			}),
		);
	});
});

// ── adminGetCurrency ──────────────────────────────────────────────────────────

describe("admin GET /currencies/:id", () => {
	it("returns 404 when currency not found", async () => {
		const result = (await call(getCurrencyHandler, {
			params: { id: "nonexistent" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Currency not found");
	});

	it("returns currency when found", async () => {
		const currency = makeCurrency({ id: "cur_1", code: "USD" });
		const ctrl = makeController({
			getById: vi.fn().mockResolvedValue(currency),
		});
		const result = (await call(getCurrencyHandler, {
			params: { id: "cur_1" },
			controller: ctrl,
		})) as { currency: Currency };
		expect(result.currency.id).toBe("cur_1");
		expect(result.currency.code).toBe("USD");
		expect(ctrl.getById).toHaveBeenCalledWith("cur_1");
	});
});

// ── adminUpdateCurrency ───────────────────────────────────────────────────────

describe("admin POST /currencies/:id/update", () => {
	it("returns 404 when currency not found", async () => {
		const result = (await call(updateCurrencyHandler, {
			params: { id: "missing" },
			body: { isActive: false },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Currency not found");
	});

	it("returns updated currency on success", async () => {
		const updated = makeCurrency({ id: "cur_2", isActive: false });
		const ctrl = makeController({
			update: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateCurrencyHandler, {
			params: { id: "cur_2" },
			body: { isActive: false },
			controller: ctrl,
		})) as { currency: Currency };
		expect(result.currency.isActive).toBe(false);
		expect(ctrl.update).toHaveBeenCalledWith(
			"cur_2",
			expect.objectContaining({ isActive: false }),
		);
	});

	it("forwards name update to controller", async () => {
		const updated = makeCurrency({ name: "Dollar" });
		const ctrl = makeController({
			update: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateCurrencyHandler, {
			params: { id: updated.id },
			body: { name: "Dollar" },
			controller: ctrl,
		})) as { currency: Currency };
		expect(result.currency.name).toBe("Dollar");
	});

	it("forwards exchangeRate update to controller", async () => {
		const updated = makeCurrency({ exchangeRate: 1.1 });
		const ctrl = makeController({
			update: vi.fn().mockResolvedValue(updated),
		});
		await call(updateCurrencyHandler, {
			params: { id: updated.id },
			body: { exchangeRate: 1.1 },
			controller: ctrl,
		});
		expect(ctrl.update).toHaveBeenCalledWith(
			updated.id,
			expect.objectContaining({ exchangeRate: 1.1 }),
		);
	});
});

// ── adminDeleteCurrency ───────────────────────────────────────────────────────

describe("admin POST /currencies/:id/delete", () => {
	it("deletes currency and returns success", async () => {
		const ctrl = makeController({
			delete: vi.fn().mockResolvedValue({ deleted: true }),
		});
		const result = (await call(deleteCurrencyHandler, {
			params: { id: "cur_3" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.delete).toHaveBeenCalledWith("cur_3");
	});

	it("returns 400 when deletion fails", async () => {
		const ctrl = makeController({
			delete: vi.fn().mockResolvedValue({
				deleted: false,
				error: "Cannot delete base currency",
			}),
		});
		const result = (await call(deleteCurrencyHandler, {
			params: { id: "cur_base" },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
		expect(result.error).toBe("Cannot delete base currency");
	});

	it("uses fallback error message when controller provides none", async () => {
		const ctrl = makeController({
			delete: vi.fn().mockResolvedValue({ deleted: false }),
		});
		const result = (await call(deleteCurrencyHandler, {
			params: { id: "cur_x" },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
		expect(typeof result.error).toBe("string");
		expect(result.error.length).toBeGreaterThan(0);
	});
});

// ── adminSetBaseCurrency ──────────────────────────────────────────────────────

describe("admin POST /currencies/:id/set-base", () => {
	it("returns 404 when currency not found", async () => {
		const result = (await call(setBaseCurrencyHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Currency not found");
	});

	it("sets base currency and returns updated currency", async () => {
		const currency = makeCurrency({ id: "cur_4", isBase: true });
		const ctrl = makeController({
			setBaseCurrency: vi.fn().mockResolvedValue(currency),
		});
		const result = (await call(setBaseCurrencyHandler, {
			params: { id: "cur_4" },
			controller: ctrl,
		})) as { currency: Currency };
		expect(result.currency.id).toBe("cur_4");
		expect(result.currency.isBase).toBe(true);
		expect(ctrl.setBaseCurrency).toHaveBeenCalledWith("cur_4");
	});
});

// ── adminUpdateRate ───────────────────────────────────────────────────────────

describe("admin POST /currencies/update-rate", () => {
	it("returns 404 when currency not found by code", async () => {
		const result = (await call(updateRateHandler, {
			body: { currencyCode: "XYZ", rate: 1.5 },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Currency not found");
	});

	it("updates exchange rate and returns currency", async () => {
		const currency = makeCurrency({ code: "EUR", exchangeRate: 0.9 });
		const ctrl = makeController({
			updateRate: vi.fn().mockResolvedValue(currency),
		});
		const result = (await call(updateRateHandler, {
			body: { currencyCode: "EUR", rate: 0.9 },
			controller: ctrl,
		})) as { currency: Currency };
		expect(result.currency.code).toBe("EUR");
		expect(result.currency.exchangeRate).toBe(0.9);
		expect(ctrl.updateRate).toHaveBeenCalledWith(
			expect.objectContaining({ currencyCode: "EUR", rate: 0.9 }),
		);
	});

	it("passes source when provided", async () => {
		const currency = makeCurrency({ code: "GBP" });
		const ctrl = makeController({
			updateRate: vi.fn().mockResolvedValue(currency),
		});
		await call(updateRateHandler, {
			body: { currencyCode: "GBP", rate: 0.79, source: "ecb" },
			controller: ctrl,
		});
		expect(ctrl.updateRate).toHaveBeenCalledWith(
			expect.objectContaining({ source: "ecb" }),
		);
	});
});

// ── adminBulkUpdateRates ──────────────────────────────────────────────────────

describe("admin POST /currencies/bulk-update-rates", () => {
	it("returns updated count and empty errors on full success", async () => {
		const ctrl = makeController({
			bulkUpdateRates: vi.fn().mockResolvedValue({ updated: 3, errors: [] }),
		});
		const result = (await call(bulkUpdateRatesHandler, {
			body: {
				rates: [
					{ currencyCode: "EUR", rate: 0.85 },
					{ currencyCode: "GBP", rate: 0.79 },
					{ currencyCode: "JPY", rate: 150.5 },
				],
			},
			controller: ctrl,
		})) as { updated: number; errors: string[] };
		expect(result.updated).toBe(3);
		expect(result.errors).toHaveLength(0);
		expect(ctrl.bulkUpdateRates).toHaveBeenCalledWith([
			{ currencyCode: "EUR", rate: 0.85 },
			{ currencyCode: "GBP", rate: 0.79 },
			{ currencyCode: "JPY", rate: 150.5 },
		]);
	});

	it("returns partial errors when some codes are unknown", async () => {
		const ctrl = makeController({
			bulkUpdateRates: vi
				.fn()
				.mockResolvedValue({ updated: 1, errors: ["XYZ: not found"] }),
		});
		const result = (await call(bulkUpdateRatesHandler, {
			body: {
				rates: [
					{ currencyCode: "EUR", rate: 0.85 },
					{ currencyCode: "XYZ", rate: 99 },
				],
			},
			controller: ctrl,
		})) as { updated: number; errors: string[] };
		expect(result.updated).toBe(1);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toMatch(/XYZ/);
	});

	it("passes source field through for each rate", async () => {
		const ctrl = makeController({
			bulkUpdateRates: vi.fn().mockResolvedValue({ updated: 1, errors: [] }),
		});
		await call(bulkUpdateRatesHandler, {
			body: {
				rates: [
					{ currencyCode: "EUR", rate: 0.85, source: "openexchangerates" },
				],
			},
			controller: ctrl,
		});
		expect(ctrl.bulkUpdateRates).toHaveBeenCalledWith([
			{ currencyCode: "EUR", rate: 0.85, source: "openexchangerates" },
		]);
	});
});

// ── adminRateHistory ──────────────────────────────────────────────────────────

describe("admin POST /currencies/rate-history", () => {
	it("returns empty history when no rates recorded", async () => {
		const ctrl = makeController({
			getRateHistory: vi.fn().mockResolvedValue([]),
		});
		const result = (await call(rateHistoryHandler, {
			body: { currencyCode: "EUR" },
			controller: ctrl,
		})) as { history: ExchangeRateHistory[] };
		expect(result.history).toHaveLength(0);
		expect(ctrl.getRateHistory).toHaveBeenCalledWith({ currencyCode: "EUR" });
	});

	it("returns rate history entries for the requested currency", async () => {
		const history = [
			makeHistory({ currencyCode: "EUR", rate: 0.83 }),
			makeHistory({ currencyCode: "EUR", rate: 0.85 }),
		];
		const ctrl = makeController({
			getRateHistory: vi.fn().mockResolvedValue(history),
		});
		const result = (await call(rateHistoryHandler, {
			body: { currencyCode: "EUR" },
			controller: ctrl,
		})) as { history: ExchangeRateHistory[] };
		expect(result.history).toHaveLength(2);
		expect(result.history[0].rate).toBe(0.83);
	});

	it("passes limit when provided", async () => {
		const ctrl = makeController({
			getRateHistory: vi.fn().mockResolvedValue([]),
		});
		await call(rateHistoryHandler, {
			body: { currencyCode: "GBP", limit: 10 },
			controller: ctrl,
		});
		expect(ctrl.getRateHistory).toHaveBeenCalledWith({
			currencyCode: "GBP",
			limit: 10,
		});
	});

	it("omits limit when not provided", async () => {
		const ctrl = makeController({
			getRateHistory: vi.fn().mockResolvedValue([]),
		});
		await call(rateHistoryHandler, {
			body: { currencyCode: "JPY" },
			controller: ctrl,
		});
		expect(ctrl.getRateHistory).toHaveBeenCalledWith({ currencyCode: "JPY" });
	});
});

// ── adminSetPriceOverride ─────────────────────────────────────────────────────

describe("admin POST /currencies/price-override", () => {
	it("sets a price override and returns it", async () => {
		const override = makeOverride({
			productId: "prod_2",
			currencyCode: "EUR",
			price: 1999,
		});
		const ctrl = makeController({
			setPriceOverride: vi.fn().mockResolvedValue(override),
		});
		const result = (await call(setPriceOverrideHandler, {
			body: { productId: "prod_2", currencyCode: "EUR", price: 1999 },
			controller: ctrl,
		})) as { override: PriceOverride };
		expect(result.override.productId).toBe("prod_2");
		expect(result.override.price).toBe(1999);
		expect(ctrl.setPriceOverride).toHaveBeenCalledWith(
			expect.objectContaining({
				productId: "prod_2",
				currencyCode: "EUR",
				price: 1999,
			}),
		);
	});

	it("passes compareAtPrice when provided", async () => {
		const override = makeOverride({ price: 1599, compareAtPrice: 1999 });
		const ctrl = makeController({
			setPriceOverride: vi.fn().mockResolvedValue(override),
		});
		const result = (await call(setPriceOverrideHandler, {
			body: {
				productId: "prod_3",
				currencyCode: "GBP",
				price: 1599,
				compareAtPrice: 1999,
			},
			controller: ctrl,
		})) as { override: PriceOverride };
		expect(result.override.compareAtPrice).toBe(1999);
		expect(ctrl.setPriceOverride).toHaveBeenCalledWith(
			expect.objectContaining({ compareAtPrice: 1999 }),
		);
	});

	it("sets override without compareAtPrice when omitted", async () => {
		const override = makeOverride({ price: 899 });
		const ctrl = makeController({
			setPriceOverride: vi.fn().mockResolvedValue(override),
		});
		await call(setPriceOverrideHandler, {
			body: { productId: "prod_4", currencyCode: "CAD", price: 899 },
			controller: ctrl,
		});
		expect(ctrl.setPriceOverride).toHaveBeenCalledWith(
			expect.objectContaining({ price: 899 }),
		);
	});
});

// ── adminListPriceOverrides ───────────────────────────────────────────────────

describe("admin GET /currencies/price-overrides/:productId", () => {
	it("returns empty array when no overrides set for product", async () => {
		const ctrl = makeController({
			listPriceOverrides: vi.fn().mockResolvedValue([]),
		});
		const result = (await call(listPriceOverridesHandler, {
			params: { productId: "prod_none" },
			controller: ctrl,
		})) as { overrides: PriceOverride[] };
		expect(result.overrides).toHaveLength(0);
		expect(ctrl.listPriceOverrides).toHaveBeenCalledWith("prod_none");
	});

	it("returns all overrides for the product", async () => {
		const overrides = [
			makeOverride({ productId: "prod_5", currencyCode: "EUR", price: 1599 }),
			makeOverride({ productId: "prod_5", currencyCode: "GBP", price: 1299 }),
		];
		const ctrl = makeController({
			listPriceOverrides: vi.fn().mockResolvedValue(overrides),
		});
		const result = (await call(listPriceOverridesHandler, {
			params: { productId: "prod_5" },
			controller: ctrl,
		})) as { overrides: PriceOverride[] };
		expect(result.overrides).toHaveLength(2);
		expect(result.overrides[0].currencyCode).toBe("EUR");
		expect(result.overrides[1].currencyCode).toBe("GBP");
	});
});

// ── adminDeletePriceOverride ──────────────────────────────────────────────────

describe("admin POST /currencies/price-overrides/:id/delete", () => {
	it("deletes the override and returns success", async () => {
		const ctrl = makeController({
			deletePriceOverride: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(deletePriceOverrideHandler, {
			params: { id: "ovr_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deletePriceOverride).toHaveBeenCalledWith("ovr_1");
	});

	it("always returns success regardless of which id is provided", async () => {
		const ctrl = makeController({
			deletePriceOverride: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(deletePriceOverrideHandler, {
			params: { id: "ovr_999" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});
