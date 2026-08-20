import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	ConvertedPrice,
	Currency,
	ExchangeRateHistory,
	MultiCurrencyController,
	PriceOverride,
	RoundingMode,
} from "./service";

function applyRounding(
	amount: number,
	decimalPlaces: number,
	mode: RoundingMode,
): number {
	const factor = 10 ** decimalPlaces;
	switch (mode) {
		case "ceil":
			return Math.ceil(amount * factor) / factor;
		case "floor":
			return Math.floor(amount * factor) / factor;
		default:
			return Math.round(amount * factor) / factor;
	}
}

function formatAmount(amount: number, currency: Currency): string {
	const fixed = amount.toFixed(currency.decimalPlaces);
	const [intPart, decPart] = fixed.split(".");

	// Apply thousands separator
	let formattedInt = intPart;
	if (currency.thousandsSeparator) {
		formattedInt = intPart.replace(
			/\B(?=(\d{3})+(?!\d))/g,
			currency.thousandsSeparator,
		);
	}

	const formattedNumber =
		currency.decimalPlaces > 0
			? `${formattedInt}${currency.decimalSeparator}${decPart}`
			: formattedInt;

	return currency.symbolPosition === "before"
		? `${currency.symbol}${formattedNumber}`
		: `${formattedNumber}${currency.symbol}`;
}

export function createMultiCurrencyController(
	data: ModuleDataService,
	events?: ScopedEventEmitter,
): MultiCurrencyController {
	async function getCurrencyByCode(code: string): Promise<Currency | null> {
		const results = (await data.findMany("currency", {
			where: { code: code.toUpperCase() },
			take: 1,
		})) as Currency[];
		return results[0] ?? null;
	}

	return {
		async create(params): Promise<Currency> {
			const id = crypto.randomUUID();
			const now = new Date();
			const code = params.code.toUpperCase();

			// If this is set as base, ensure rate is 1
			const isBase = params.isBase ?? false;
			const exchangeRate = isBase ? 1 : (params.exchangeRate ?? 1);

			// If setting as base, unset any existing base
			if (isBase) {
				const existing = (await data.findMany("currency", {
					where: { isBase: true },
				})) as Currency[];
				for (const c of existing) {
					const record = { ...c, isBase: false, updatedAt: now };
					await data.upsert(
						"currency",
						c.id,
						record as Record<string, unknown>,
					);
				}
			}

			const currency: Currency = {
				id,
				code,
				name: params.name,
				symbol: params.symbol,
				decimalPlaces: params.decimalPlaces ?? 2,
				exchangeRate,
				isBase,
				isActive: params.isActive ?? true,
				symbolPosition: params.symbolPosition ?? "before",
				thousandsSeparator: params.thousandsSeparator ?? ",",
				decimalSeparator: params.decimalSeparator ?? ".",
				roundingMode: params.roundingMode ?? "round",
				sortOrder: params.sortOrder ?? 0,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("currency", id, currency as Record<string, unknown>);

			if (events) {
				void events.emit("currency.created", {
					id: currency.id,
					code: currency.code,
				});
			}

			return currency;
		},

		async getById(id: string): Promise<Currency | null> {
			return (await data.get("currency", id)) as Currency | null;
		},

		async getByCode(code: string): Promise<Currency | null> {
			return getCurrencyByCode(code);
		},

		async update(id, params): Promise<Currency | null> {
			const existing = (await data.get("currency", id)) as Currency | null;
			if (!existing) return null;

			const updated: Currency = {
				...existing,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.symbol !== undefined ? { symbol: params.symbol } : {}),
				...(params.decimalPlaces !== undefined
					? { decimalPlaces: params.decimalPlaces }
					: {}),
				...(params.exchangeRate !== undefined
					? { exchangeRate: params.exchangeRate }
					: {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				...(params.symbolPosition !== undefined
					? { symbolPosition: params.symbolPosition }
					: {}),
				...(params.thousandsSeparator !== undefined
					? { thousandsSeparator: params.thousandsSeparator }
					: {}),
				...(params.decimalSeparator !== undefined
					? { decimalSeparator: params.decimalSeparator }
					: {}),
				...(params.roundingMode !== undefined
					? { roundingMode: params.roundingMode }
					: {}),
				...(params.sortOrder !== undefined
					? { sortOrder: params.sortOrder }
					: {}),
				updatedAt: new Date(),
			};

			await data.upsert("currency", id, updated as Record<string, unknown>);

			if (events) {
				void events.emit("currency.updated", {
					id: updated.id,
					code: updated.code,
				});
			}

			return updated;
		},

		async delete(id: string): Promise<{ deleted: boolean; error?: string }> {
			const currency = (await data.get("currency", id)) as Currency | null;
			if (!currency) {
				return { deleted: false, error: "Currency not found" };
			}
			if (currency.isBase) {
				return {
					deleted: false,
					error: "Cannot delete the base currency",
				};
			}

			// Delete price overrides for this currency
			const overrides = (await data.findMany("priceOverride", {
				where: { currencyCode: currency.code },
			})) as PriceOverride[];
			for (const o of overrides) {
				await data.delete("priceOverride", o.id);
			}

			// Delete rate history
			const history = (await data.findMany("exchangeRateHistory", {
				where: { currencyCode: currency.code },
			})) as ExchangeRateHistory[];
			for (const h of history) {
				await data.delete("exchangeRateHistory", h.id);
			}

			await data.delete("currency", id);

			if (events) {
				void events.emit("currency.deleted", {
					id: currency.id,
					code: currency.code,
				});
			}

			return { deleted: true };
		},

		async list(params): Promise<Currency[]> {
			const where = params?.activeOnly ? { isActive: true } : {};
			const currencies = (await data.findMany("currency", {
				where,
			})) as Currency[];
			currencies.sort((a, b) => a.sortOrder - b.sortOrder);
			return currencies;
		},

		async getBaseCurrency(): Promise<Currency | null> {
			const results = (await data.findMany("currency", {
				where: { isBase: true },
				take: 1,
			})) as Currency[];
			return results[0] ?? null;
		},

		async setBaseCurrency(id: string): Promise<Currency | null> {
			const currency = (await data.get("currency", id)) as Currency | null;
			if (!currency) return null;

			const now = new Date();

			// Unset existing base currencies
			const existing = (await data.findMany("currency", {
				where: { isBase: true },
			})) as Currency[];
			for (const c of existing) {
				if (c.id !== id) {
					const record = { ...c, isBase: false, updatedAt: now };
					await data.upsert(
						"currency",
						c.id,
						record as Record<string, unknown>,
					);
				}
			}

			const updated: Currency = {
				...currency,
				isBase: true,
				exchangeRate: 1,
				updatedAt: now,
			};

			await data.upsert("currency", id, updated as Record<string, unknown>);

			if (events) {
				void events.emit("currency.baseChanged", {
					id: updated.id,
					code: updated.code,
				});
			}

			return updated;
		},

		async updateRate(params): Promise<Currency | null> {
			const currency = await getCurrencyByCode(params.currencyCode);
			if (!currency) return null;

			if (currency.isBase) return currency; // Base rate is always 1

			const now = new Date();

			// Record history
			const historyId = crypto.randomUUID();
			const historyEntry: ExchangeRateHistory = {
				id: historyId,
				currencyCode: currency.code,
				rate: params.rate,
				source: params.source ?? "manual",
				recordedAt: now,
			};
			await data.upsert(
				"exchangeRateHistory",
				historyId,
				historyEntry as Record<string, unknown>,
			);

			// Update the currency
			const updated: Currency = {
				...currency,
				exchangeRate: params.rate,
				updatedAt: now,
			};
			const updatedRecord = updated as Record<string, unknown>;
			await data.upsert("currency", currency.id, updatedRecord);

			if (events) {
				void events.emit("currency.rateUpdated", {
					code: currency.code,
					oldRate: currency.exchangeRate,
					newRate: params.rate,
					source: params.source ?? "manual",
				});
			}

			return updated;
		},

		async bulkUpdateRates(
			rates,
		): Promise<{ updated: number; errors: string[] }> {
			let updated = 0;
			const errors: string[] = [];

			for (const entry of rates) {
				const result = await this.updateRate(entry);
				if (result) {
					updated++;
				} else {
					errors.push(`Currency not found: ${entry.currencyCode}`);
				}
			}

			return { updated, errors };
		},

		async getRateHistory(params): Promise<ExchangeRateHistory[]> {
			const { currencyCode, limit = 50 } = params;
			const history = (await data.findMany("exchangeRateHistory", {
				where: { currencyCode: currencyCode.toUpperCase() },
			})) as ExchangeRateHistory[];

			history.sort(
				(a, b) =>
					new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
			);

			return history.slice(0, limit);
		},

		async convert(params): Promise<ConvertedPrice | null> {
			const { amount, to, from } = params;

			const targetCurrency = await getCurrencyByCode(to);
			if (!targetCurrency) return null;

			let convertedAmount: number;

			if (from) {
				// Convert from a non-base currency
				const sourceCurrency = await getCurrencyByCode(from);
				if (!sourceCurrency) return null;

				// Convert to base first, then to target
				const inBase = amount / sourceCurrency.exchangeRate;
				convertedAmount = inBase * targetCurrency.exchangeRate;
			} else {
				// Convert from base currency
				convertedAmount = amount * targetCurrency.exchangeRate;
			}

			convertedAmount = applyRounding(
				convertedAmount,
				targetCurrency.decimalPlaces,
				targetCurrency.roundingMode,
			);

			return {
				amount: convertedAmount,
				currency: targetCurrency,
				formatted: formatAmount(convertedAmount, targetCurrency),
			};
		},

		async formatPrice(
			amount: number,
			currencyCode: string,
		): Promise<string | null> {
			const currency = await getCurrencyByCode(currencyCode);
			if (!currency) return null;
			return formatAmount(amount, currency);
		},

		async setPriceOverride(params): Promise<PriceOverride> {
			const code = params.currencyCode.toUpperCase();

			// Check if override exists for this product+currency
			const existing = (await data.findMany("priceOverride", {
				where: {
					productId: params.productId,
					currencyCode: code,
				},
				take: 1,
			})) as PriceOverride[];

			const now = new Date();
			const id = existing[0]?.id ?? crypto.randomUUID();

			const override: PriceOverride = {
				id,
				productId: params.productId,
				currencyCode: code,
				price: params.price,
				compareAtPrice: params.compareAtPrice,
				createdAt: existing[0]?.createdAt ?? now,
				updatedAt: now,
			};

			await data.upsert(
				"priceOverride",
				id,
				override as Record<string, unknown>,
			);
			return override;
		},

		async getPriceOverride(
			productId: string,
			currencyCode: string,
		): Promise<PriceOverride | null> {
			const results = (await data.findMany("priceOverride", {
				where: {
					productId,
					currencyCode: currencyCode.toUpperCase(),
				},
				take: 1,
			})) as PriceOverride[];
			return results[0] ?? null;
		},

		async listPriceOverrides(productId: string): Promise<PriceOverride[]> {
			return (await data.findMany("priceOverride", {
				where: { productId },
			})) as PriceOverride[];
		},

		async deletePriceOverride(id: string): Promise<void> {
			await data.delete("priceOverride", id);
		},

		async getProductPrice(params): Promise<ConvertedPrice | null> {
			const { productId, basePriceInCents, currencyCode } = params;

			const currency = await getCurrencyByCode(currencyCode);
			if (!currency) return null;

			// Check for price override first
			const override = await this.getPriceOverride(productId, currencyCode);
			if (override) {
				// Convert from cents to display amount
				const displayAmount = override.price / 10 ** currency.decimalPlaces;
				return {
					amount: override.price,
					currency,
					formatted: formatAmount(displayAmount, currency),
				};
			}

			// Fall back to conversion from base currency
			const baseCurrency = await this.getBaseCurrency();
			if (!baseCurrency) return null;

			// Convert cents to base currency amount
			const baseAmount = basePriceInCents / 10 ** baseCurrency.decimalPlaces;
			const converted = baseAmount * currency.exchangeRate;
			const rounded = applyRounding(
				converted,
				currency.decimalPlaces,
				currency.roundingMode,
			);

			// Return amount in smallest unit (cents)
			const amountInSmallestUnit = Math.round(
				rounded * 10 ** currency.decimalPlaces,
			);

			return {
				amount: amountInSmallestUnit,
				currency,
				formatted: formatAmount(rounded, currency),
			};
		},
	};
}
