import type { ModuleSchema } from "@86d-app/core/types/schema";

export const multiCurrencySchema = {
	currency: {
		fields: {
			id: { type: "string", required: true },
			/** ISO 4217 currency code (e.g., "USD", "EUR", "GBP") */
			code: { type: "string", required: true, unique: true },
			/** Display name (e.g., "US Dollar") */
			name: { type: "string", required: true },
			/** Currency symbol (e.g., "$", "EUR") */
			symbol: { type: "string", required: true },
			/** Number of decimal places (e.g., 2 for USD, 0 for JPY) */
			decimalPlaces: { type: "number", required: true, defaultValue: 2 },
			/** Exchange rate relative to the store's base currency */
			exchangeRate: { type: "number", required: true, defaultValue: 1 },
			/** Whether this is the store's base/default currency */
			isBase: { type: "boolean", required: true, defaultValue: false },
			/** Whether this currency is enabled for display */
			isActive: { type: "boolean", required: true, defaultValue: true },
			/** Symbol position: "before" ($100) or "after" (100EUR) */
			symbolPosition: {
				type: ["before", "after"],
				required: true,
				defaultValue: "before",
			},
			/** Thousands separator (e.g., ",") */
			thousandsSeparator: {
				type: "string",
				required: true,
				defaultValue: ",",
			},
			/** Decimal separator (e.g., ".") */
			decimalSeparator: {
				type: "string",
				required: true,
				defaultValue: ".",
			},
			/** Rounding mode for conversions */
			roundingMode: {
				type: ["round", "ceil", "floor"],
				required: true,
				defaultValue: "round",
			},
			/** Display order in currency selector */
			sortOrder: { type: "number", required: true, defaultValue: 0 },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
	exchangeRateHistory: {
		fields: {
			id: { type: "string", required: true },
			/** The currency this rate applies to */
			currencyCode: { type: "string", required: true },
			/** The exchange rate at this point in time */
			rate: { type: "number", required: true },
			/** Source of the rate (e.g., "manual", "api", "openexchangerates") */
			source: { type: "string", required: true, defaultValue: "manual" },
			/** When this rate was recorded */
			recordedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
		},
	},
	priceOverride: {
		fields: {
			id: { type: "string", required: true },
			/** The product or variant this override applies to */
			productId: { type: "string", required: true },
			/** The currency code for this override */
			currencyCode: { type: "string", required: true },
			/** Fixed price in this currency (in smallest unit, e.g., cents) */
			price: { type: "number", required: true },
			/** Optional compare-at price for display */
			compareAtPrice: { type: "number", required: false },
			createdAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
			},
			updatedAt: {
				type: "date",
				required: true,
				defaultValue: () => new Date(),
				onUpdate: () => new Date(),
			},
		},
	},
} satisfies ModuleSchema;
