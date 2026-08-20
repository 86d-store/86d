import type { ModuleController } from "@86d-app/core/types/module";

export type SymbolPosition = "before" | "after";
export type RoundingMode = "round" | "ceil" | "floor";

export type Currency = {
	id: string;
	code: string;
	name: string;
	symbol: string;
	decimalPlaces: number;
	exchangeRate: number;
	isBase: boolean;
	isActive: boolean;
	symbolPosition: SymbolPosition;
	thousandsSeparator: string;
	decimalSeparator: string;
	roundingMode: RoundingMode;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
};

export type ExchangeRateHistory = {
	id: string;
	currencyCode: string;
	rate: number;
	source: string;
	recordedAt: Date;
};

export type PriceOverride = {
	id: string;
	productId: string;
	currencyCode: string;
	price: number;
	compareAtPrice?: number | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type ConvertedPrice = {
	amount: number;
	currency: Currency;
	formatted: string;
};

export type MultiCurrencyController = ModuleController & {
	/** Create a new currency */
	create(params: {
		code: string;
		name: string;
		symbol: string;
		decimalPlaces?: number | undefined;
		exchangeRate?: number | undefined;
		isBase?: boolean | undefined;
		isActive?: boolean | undefined;
		symbolPosition?: SymbolPosition | undefined;
		thousandsSeparator?: string | undefined;
		decimalSeparator?: string | undefined;
		roundingMode?: RoundingMode | undefined;
		sortOrder?: number | undefined;
	}): Promise<Currency>;

	/** Get currency by ID */
	getById(id: string): Promise<Currency | null>;

	/** Get currency by ISO code */
	getByCode(code: string): Promise<Currency | null>;

	/** Update a currency */
	update(
		id: string,
		params: {
			name?: string | undefined;
			symbol?: string | undefined;
			decimalPlaces?: number | undefined;
			exchangeRate?: number | undefined;
			isActive?: boolean | undefined;
			symbolPosition?: SymbolPosition | undefined;
			thousandsSeparator?: string | undefined;
			decimalSeparator?: string | undefined;
			roundingMode?: RoundingMode | undefined;
			sortOrder?: number | undefined;
		},
	): Promise<Currency | null>;

	/** Delete a currency (cannot delete the base currency) */
	delete(id: string): Promise<{ deleted: boolean; error?: string }>;

	/** List all currencies */
	list(params?: { activeOnly?: boolean | undefined }): Promise<Currency[]>;

	/** Get the store's base currency */
	getBaseCurrency(): Promise<Currency | null>;

	/** Set a currency as the base currency */
	setBaseCurrency(id: string): Promise<Currency | null>;

	/** Update exchange rate and record history */
	updateRate(params: {
		currencyCode: string;
		rate: number;
		source?: string | undefined;
	}): Promise<Currency | null>;

	/** Bulk update exchange rates */
	bulkUpdateRates(
		rates: Array<{
			currencyCode: string;
			rate: number;
			source?: string | undefined;
		}>,
	): Promise<{ updated: number; errors: string[] }>;

	/** Get rate history for a currency */
	getRateHistory(params: {
		currencyCode: string;
		limit?: number | undefined;
	}): Promise<ExchangeRateHistory[]>;

	/** Convert an amount from base currency to target currency */
	convert(params: {
		amount: number;
		to: string;
		from?: string | undefined;
	}): Promise<ConvertedPrice | null>;

	/** Format an amount in a given currency */
	formatPrice(amount: number, currencyCode: string): Promise<string | null>;

	/** Set a fixed price override for a product in a given currency */
	setPriceOverride(params: {
		productId: string;
		currencyCode: string;
		price: number;
		compareAtPrice?: number | undefined;
	}): Promise<PriceOverride>;

	/** Get price override for a product in a given currency */
	getPriceOverride(
		productId: string,
		currencyCode: string,
	): Promise<PriceOverride | null>;

	/** List all price overrides for a product */
	listPriceOverrides(productId: string): Promise<PriceOverride[]>;

	/** Delete a price override */
	deletePriceOverride(id: string): Promise<void>;

	/**
	 * Get the best price for a product in a given currency.
	 * Uses price override if available, otherwise converts from base.
	 */
	getProductPrice(params: {
		productId: string;
		basePriceInCents: number;
		currencyCode: string;
	}): Promise<ConvertedPrice | null>;
};
