import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const multiCurrencyCurrencyShape = z.object({
	id: z.string().register(col, { pk: true }),
	code: z.string().register(col, { unique: true }),
	name: z.string(),
	symbol: z.string(),
	decimalPlaces: z.int().default(2),
	exchangeRate: z.int().default(1),
	isBase: z.boolean().default(false),
	isActive: z.boolean().default(true),
	symbolPosition: z.enum(["before", "after"]).default("before"),
	thousandsSeparator: z.string().default(","),
	decimalSeparator: z.string().default("."),
	roundingMode: z.enum(["round", "ceil", "floor"]).default("round"),
	sortOrder: z.int().default(0),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const multiCurrencyExchangeRateHistoryShape = z.object({
	id: z.string().register(col, { pk: true }),
	currencyCode: z.string(),
	rate: z.number(),
	source: z.string().default("manual"),
	recordedAt: z.coerce.date().default(() => new Date()),
});

export const multiCurrencyPriceOverrideShape = z.object({
	id: z.string().register(col, { pk: true }),
	productId: z.string(),
	currencyCode: z.string(),
	price: z.number(),
	compareAtPrice: z.number().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for multi-currency. */
export const multiCurrencyStorage = {
	kind: "relational",
	tables: {
		currency: {
			shape: multiCurrencyCurrencyShape,
		},
		exchangeRateHistory: {
			shape: multiCurrencyExchangeRateHistoryShape,
		},
		priceOverride: {
			shape: multiCurrencyPriceOverrideShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
