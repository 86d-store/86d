import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import { createAdminEndpointsWithSettings } from "./admin/endpoints/routes";
import { createTaxQuoteProvider } from "./capabilities";
import { createTaxQuoteV2Provider } from "./capabilities-v2";
import { TaxJarQuoteProviderV2 } from "./provider-v2";
import { taxStorage } from "./schema";
import { createTaxController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type { TaxQuoteV2Dependencies } from "./capabilities-v2";
export type {
	TaxJarQuoteProviderV2Options,
	TaxProviderV2Result,
	TaxQuoteProviderV2,
} from "./provider-v2";
export type {
	CreateTaxCategoryParams,
	CreateTaxExemptionParams,
	CreateTaxNexusParams,
	CreateTaxRateParams,
	TaxAddress,
	TaxCalculation,
	TaxCategory,
	TaxController,
	TaxExemption,
	TaxExemptionType,
	TaxLineItem,
	TaxLineResult,
	TaxNexus,
	TaxNexusType,
	TaxRate,
	TaxRateType,
	TaxReportParams,
	TaxReportSummary,
	TaxTransaction,
	UpdateTaxRateParams,
} from "./service";

export interface TaxOptions extends ModuleConfig {
	/** Whether to tax shipping by default. @default false */
	taxShipping?: boolean;
	/** TaxJar API key for real-time tax calculation */
	taxjarApiKey?: string | undefined;
	/** Use TaxJar sandbox environment (default: false) */
	taxjarSandbox?: boolean | undefined;
	/** Immutable Store Connection used for new TaxJar v2 quotes. */
	taxjarConnectionId?: string | undefined;
	/** Server-owned TaxJar origin country. */
	taxjarOriginCountry?: string | undefined;
	/** Server-owned TaxJar origin state or province. */
	taxjarOriginState?: string | undefined;
	/** Server-owned TaxJar origin postal code. */
	taxjarOriginPostalCode?: string | undefined;
	/** Optional server-owned TaxJar origin city. */
	taxjarOriginCity?: string | undefined;
	/** Optional server-owned TaxJar origin street. */
	taxjarOriginStreet?: string | undefined;
}

export default function tax(options?: TaxOptions): Module {
	const settingsEndpoint = createGetSettingsEndpoint({
		taxjarApiKey: options?.taxjarApiKey,
		taxjarSandbox: options?.taxjarSandbox,
	});
	const taxJarV2Provider =
		options?.taxjarApiKey &&
		options.taxjarConnectionId &&
		options.taxjarOriginCountry &&
		options.taxjarOriginState &&
		options.taxjarOriginPostalCode
			? new TaxJarQuoteProviderV2({
					apiKey: options.taxjarApiKey,
					sandbox: options.taxjarSandbox ?? false,
					connectionId: options.taxjarConnectionId,
					origin: {
						country: options.taxjarOriginCountry,
						state: options.taxjarOriginState,
						postalCode: options.taxjarOriginPostalCode,
						city: options.taxjarOriginCity,
						street: options.taxjarOriginStreet,
					},
				})
			: undefined;

	return {
		id: "tax",
		version: "0.0.1",
		storage: taxStorage,
		capabilities: {
			provides: [
				createTaxQuoteV2Provider({ provider: taxJarV2Provider }),
				createTaxQuoteProvider({
					taxjarApiKey: options?.taxjarApiKey,
					taxjarSandbox: options?.taxjarSandbox,
				}),
			],
		},
		exports: {
			read: [
				"taxRate",
				"taxCalculation",
				"taxExemptionStatus",
				"taxNexus",
				"taxTransaction",
				"taxReport",
			],
		},
		events: {
			emits: [
				"tax.rate_created",
				"tax.rate_updated",
				"tax.rate_deleted",
				"tax.exemption_created",
				"tax.exemption_deleted",
				"tax.nexus_created",
				"tax.nexus_deleted",
				"tax.transaction_logged",
			],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createTaxController(ctx.data, ctx.events, {
				taxjarApiKey: options?.taxjarApiKey,
				taxjarSandbox: options?.taxjarSandbox,
			});
			return {
				controllers: { tax: controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: createAdminEndpointsWithSettings(settingsEndpoint),
		},

		admin: {
			pages: [
				{
					path: "/admin/tax",
					component: "TaxRates",
					label: "Tax Rates",
					icon: "CurrencyDollar",
					group: "Finance",
				},
				{
					path: "/admin/tax/reporting",
					component: "TaxReporting",
					label: "Tax Reporting",
					icon: "ChartBar",
					group: "Finance",
				},
			],
		},

		options,
	};
}
