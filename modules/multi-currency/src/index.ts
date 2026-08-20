import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { productPriceConversionProvider } from "./capabilities";
import { multiCurrencySchema } from "./schema";
import { createMultiCurrencyController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	ConvertedPrice,
	Currency,
	ExchangeRateHistory,
	MultiCurrencyController,
	PriceOverride,
	RoundingMode,
	SymbolPosition,
} from "./service";

export interface MultiCurrencyOptions extends ModuleConfig {
	/**
	 * Default base currency code (ISO 4217).
	 * @default "USD"
	 */
	baseCurrency?: string;
}

/**
 * Multi-currency module factory.
 * Provides currency management, exchange rate tracking, price conversion,
 * and per-product price overrides for international commerce.
 */
export default function multiCurrency(options?: MultiCurrencyOptions): Module {
	return {
		id: "multi-currency",
		version: "0.0.1",
		schema: multiCurrencySchema,
		capabilities: { provides: [productPriceConversionProvider] },
		exports: {
			read: [
				"currencyCode",
				"exchangeRate",
				"formattedPrice",
				"convertedAmount",
			],
		},
		events: {
			emits: [
				"currency.created",
				"currency.updated",
				"currency.deleted",
				"currency.baseChanged",
				"currency.rateUpdated",
			],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createMultiCurrencyController(ctx.data, ctx.events);
			return {
				controllers: { multiCurrency: controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/currencies",
					component: "CurrencyList",
					label: "Currencies",
					icon: "Coins",
					group: "Finance",
				},
				{
					path: "/admin/currencies/new",
					component: "CurrencyForm",
				},
				{
					path: "/admin/currencies/:id",
					component: "CurrencyDetail",
				},
				{
					path: "/admin/currencies/:id/edit",
					component: "CurrencyForm",
				},
			],
		},

		options,
	};
}
