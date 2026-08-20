import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import { createAdminEndpointsWithSettings } from "./admin/endpoints/routes";
import { GA4Provider } from "./providers/ga4";
import { analyticsSchema, analyticsTables } from "./schema";
import { createAnalyticsController } from "./service-impl";
import { createClientConfigEndpoint } from "./store/endpoints/get-client-config";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	AnalyticsController,
	AnalyticsEvent,
	EventStats,
	EventType,
	FunnelStep,
	ProductSalesStats,
	ProductStats,
	RecentlyViewedItem,
	RevenueSummary,
	RevenueTimeSeriesPoint,
	SearchAnalytics,
	SearchQueryStats,
} from "./service";

export interface AnalyticsOptions extends ModuleConfig {
	/** Maximum events to retain (default: unlimited). Not enforced at module level. */
	maxEvents?: string;
	/** Google Tag Manager container ID (e.g. "GTM-XXXXXXX") */
	gtmContainerId?: string | undefined;
	/** Sentry DSN for error tracking and performance monitoring */
	sentryDsn?: string | undefined;
	/** GA4 Measurement ID for server-side event forwarding (e.g. "G-XXXXXXXXXX") */
	ga4MeasurementId?: string | undefined;
	/** GA4 Measurement Protocol API secret (from GA4 Admin → Data Streams) */
	ga4ApiSecret?: string | undefined;
}

export default function analytics(options?: AnalyticsOptions): Module {
	const ga4Provider =
		options?.ga4MeasurementId && options?.ga4ApiSecret
			? new GA4Provider(options.ga4MeasurementId, options.ga4ApiSecret)
			: undefined;

	const settingsEndpoint = createGetSettingsEndpoint({
		gtmContainerId: options?.gtmContainerId,
		sentryDsn: options?.sentryDsn,
		ga4MeasurementId: options?.ga4MeasurementId,
		ga4ApiSecret: options?.ga4ApiSecret,
	});

	const clientConfigEndpoint = createClientConfigEndpoint({
		gtmContainerId: options?.gtmContainerId,
	});

	return {
		id: "analytics",
		version: "0.0.1",
		schema: analyticsSchema,
		tables: analyticsTables,
		exports: {
			read: [
				"eventStats",
				"topProducts",
				"revenueSummary",
				"conversionFunnel",
				"salesByProduct",
			],
		},
		events: {
			emits: ["analytics.report.generated"],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createAnalyticsController(ctx.data, ga4Provider);
			return { controllers: { analytics: controller } };
		},
		endpoints: {
			store: {
				...storeEndpoints,
				"/analytics/client-config": clientConfigEndpoint,
			},
			admin: createAdminEndpointsWithSettings(settingsEndpoint),
		},
		admin: {
			pages: [
				{
					path: "/admin/analytics",
					component: "AnalyticsAdmin",
					label: "Analytics",
					icon: "ChartBar",
					group: "System",
				},
				{
					path: "/admin/analytics/settings",
					component: "AnalyticsSettings",
					label: "Settings",
					icon: "Gear",
					group: "System",
				},
			],
		},
		options,
	};
}
