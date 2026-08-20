import { describe, expect, it, vi } from "vitest";
import { getFunnelEndpoint } from "../admin/endpoints/get-funnel";
import { getRevenueEndpoint } from "../admin/endpoints/get-revenue";
import { getRevenueTimeSeriesEndpoint } from "../admin/endpoints/get-revenue-timeseries";
import { getSalesByProductEndpoint } from "../admin/endpoints/get-sales-by-product";
import { getSearchAnalyticsEndpoint } from "../admin/endpoints/get-search-analytics";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { getStatsEndpoint } from "../admin/endpoints/get-stats";
import { getTopProductsEndpoint } from "../admin/endpoints/get-top-products";
import { listEventsEndpoint } from "../admin/endpoints/list-events";
import type {
	AnalyticsController,
	AnalyticsEvent,
	EventStats,
	EventType,
	FunnelStep,
	ProductSalesStats,
	ProductStats,
	RevenueSummary,
	RevenueTimeSeriesPoint,
	SearchAnalytics,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
	return {
		id: crypto.randomUUID(),
		type: "pageView" as EventType,
		data: {},
		createdAt: new Date(),
		...overrides,
	};
}

function makeRevenueSummary(
	overrides: Partial<RevenueSummary> = {},
): RevenueSummary {
	return {
		totalRevenue: 0,
		orderCount: 0,
		averageOrderValue: 0,
		previousRevenue: 0,
		previousOrders: 0,
		...overrides,
	};
}

function makeSearchAnalytics(
	overrides: Partial<SearchAnalytics> = {},
): SearchAnalytics {
	return {
		totalSearches: 0,
		uniqueQueries: 0,
		zeroResultCount: 0,
		topQueries: [],
		zeroResultQueries: [],
		...overrides,
	};
}

function makeController(
	overrides: Partial<AnalyticsController> = {},
): AnalyticsController {
	return {
		track: vi.fn().mockResolvedValue(makeEvent()),
		listEvents: vi.fn().mockResolvedValue([]),
		getStats: vi.fn().mockResolvedValue([]),
		getTopProducts: vi.fn().mockResolvedValue([]),
		getRevenueSummary: vi.fn().mockResolvedValue(makeRevenueSummary()),
		getRevenueTimeSeries: vi.fn().mockResolvedValue([]),
		getConversionFunnel: vi.fn().mockResolvedValue([]),
		getSalesByProduct: vi.fn().mockResolvedValue([]),
		getSearchAnalytics: vi.fn().mockResolvedValue(makeSearchAnalytics()),
		getRecentlyViewed: vi.fn().mockResolvedValue([]),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: AnalyticsController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { analytics: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listHandler = extractHandler(listEventsEndpoint);
const statsHandler = extractHandler(getStatsEndpoint);
const topProductsHandler = extractHandler(getTopProductsEndpoint);
const revenueHandler = extractHandler(getRevenueEndpoint);
const timeseriesHandler = extractHandler(getRevenueTimeSeriesEndpoint);
const funnelHandler = extractHandler(getFunnelEndpoint);
const salesByProductHandler = extractHandler(getSalesByProductEndpoint);
const searchHandler = extractHandler(getSearchAnalyticsEndpoint);
const settingsHandler = extractHandler(createGetSettingsEndpoint({}));

// ── admin GET /analytics/events ───────────────────────────────────────────────

describe("admin GET /analytics/events", () => {
	it("returns empty list when no events exist", async () => {
		const result = (await call(listHandler)) as {
			events: AnalyticsEvent[];
			total: number;
		};
		expect(result.events).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns events from controller", async () => {
		const events = [
			makeEvent({ type: "purchase" }),
			makeEvent({ type: "addToCart" }),
		];
		const ctrl = makeController({
			listEvents: vi.fn().mockResolvedValue(events),
		});
		const result = (await call(listHandler, { controller: ctrl })) as {
			events: AnalyticsEvent[];
			total: number;
		};
		expect(result.events).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("passes type filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { type: "purchase" },
			controller: ctrl,
		});
		expect(ctrl.listEvents).toHaveBeenCalledWith(
			expect.objectContaining({ type: "purchase" }),
		);
	});

	it("passes customerId filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { customerId: "cust-42" },
			controller: ctrl,
		});
		expect(ctrl.listEvents).toHaveBeenCalledWith(
			expect.objectContaining({ customerId: "cust-42" }),
		);
	});
});

// ── admin GET /analytics/stats ────────────────────────────────────────────────

describe("admin GET /analytics/stats", () => {
	it("returns empty stats list", async () => {
		const result = (await call(statsHandler)) as { stats: EventStats[] };
		expect(result.stats).toHaveLength(0);
	});

	it("returns stats from controller", async () => {
		const stats: EventStats[] = [
			{ type: "pageView", count: 500 },
			{ type: "purchase", count: 30 },
		];
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: EventStats[];
		};
		expect(result.stats).toHaveLength(2);
		expect(result.stats[0].type).toBe("pageView");
		expect(result.stats[0].count).toBe(500);
	});

	it("passes date filters to controller", async () => {
		const ctrl = makeController();
		await call(statsHandler, {
			query: { since: "2026-01-01", until: "2026-01-31" },
			controller: ctrl,
		});
		expect(ctrl.getStats).toHaveBeenCalledWith(
			expect.objectContaining({
				since: expect.any(Date),
				until: expect.any(Date),
			}),
		);
	});
});

// ── admin GET /analytics/top-products ────────────────────────────────────────

describe("admin GET /analytics/top-products", () => {
	it("returns empty list when no data", async () => {
		const result = (await call(topProductsHandler)) as {
			products: ProductStats[];
		};
		expect(result.products).toHaveLength(0);
	});

	it("returns top products from controller", async () => {
		const products: ProductStats[] = [
			{ productId: "prod-1", views: 120, purchases: 15 },
			{ productId: "prod-2", views: 80, purchases: 8 },
		];
		const ctrl = makeController({
			getTopProducts: vi.fn().mockResolvedValue(products),
		});
		const result = (await call(topProductsHandler, { controller: ctrl })) as {
			products: ProductStats[];
		};
		expect(result.products).toHaveLength(2);
		expect(result.products[0].productId).toBe("prod-1");
		expect(result.products[0].views).toBe(120);
	});

	it("passes limit to controller", async () => {
		const ctrl = makeController();
		await call(topProductsHandler, {
			query: { limit: "5" },
			controller: ctrl,
		});
		expect(ctrl.getTopProducts).toHaveBeenCalledWith(
			expect.objectContaining({ limit: 5 }),
		);
	});
});

// ── admin GET /analytics/revenue ─────────────────────────────────────────────

describe("admin GET /analytics/revenue", () => {
	it("returns zero-state revenue summary", async () => {
		const result = (await call(revenueHandler)) as { summary: RevenueSummary };
		expect(result.summary.totalRevenue).toBe(0);
		expect(result.summary.orderCount).toBe(0);
	});

	it("returns revenue summary from controller", async () => {
		const summary = makeRevenueSummary({
			totalRevenue: 500000,
			orderCount: 200,
			averageOrderValue: 2500,
			previousRevenue: 420000,
			previousOrders: 168,
		});
		const ctrl = makeController({
			getRevenueSummary: vi.fn().mockResolvedValue(summary),
		});
		const result = (await call(revenueHandler, { controller: ctrl })) as {
			summary: RevenueSummary;
		};
		expect(result.summary.totalRevenue).toBe(500000);
		expect(result.summary.orderCount).toBe(200);
		expect(result.summary.averageOrderValue).toBe(2500);
		expect(result.summary.previousRevenue).toBe(420000);
	});
});

// ── admin GET /analytics/revenue/timeseries ───────────────────────────────────

describe("admin GET /analytics/revenue/timeseries", () => {
	it("returns empty timeseries", async () => {
		const result = (await call(timeseriesHandler)) as {
			timeseries: RevenueTimeSeriesPoint[];
		};
		expect(result.timeseries).toHaveLength(0);
	});

	it("returns timeseries points from controller", async () => {
		const timeseries: RevenueTimeSeriesPoint[] = [
			{ date: "2026-01-01", revenue: 10000, orders: 4 },
			{ date: "2026-01-02", revenue: 25000, orders: 10 },
		];
		const ctrl = makeController({
			getRevenueTimeSeries: vi.fn().mockResolvedValue(timeseries),
		});
		const result = (await call(timeseriesHandler, { controller: ctrl })) as {
			timeseries: RevenueTimeSeriesPoint[];
		};
		expect(result.timeseries).toHaveLength(2);
		expect(result.timeseries[0].date).toBe("2026-01-01");
		expect(result.timeseries[1].revenue).toBe(25000);
	});
});

// ── admin GET /analytics/funnel ───────────────────────────────────────────────

describe("admin GET /analytics/funnel", () => {
	it("returns empty funnel", async () => {
		const result = (await call(funnelHandler)) as { funnel: FunnelStep[] };
		expect(result.funnel).toHaveLength(0);
	});

	it("returns funnel steps from controller", async () => {
		const funnel: FunnelStep[] = [
			{ step: "pageView", count: 1000, rate: 100 },
			{ step: "productView", count: 600, rate: 60 },
			{ step: "addToCart", count: 200, rate: 20 },
			{ step: "purchase", count: 80, rate: 8 },
		];
		const ctrl = makeController({
			getConversionFunnel: vi.fn().mockResolvedValue(funnel),
		});
		const result = (await call(funnelHandler, { controller: ctrl })) as {
			funnel: FunnelStep[];
		};
		expect(result.funnel).toHaveLength(4);
		expect(result.funnel[0].step).toBe("pageView");
		expect(result.funnel[0].rate).toBe(100);
		expect(result.funnel[3].rate).toBe(8);
	});
});

// ── admin GET /analytics/sales-by-product ────────────────────────────────────

describe("admin GET /analytics/sales-by-product", () => {
	it("returns empty list when no sales", async () => {
		const result = (await call(salesByProductHandler)) as {
			products: ProductSalesStats[];
		};
		expect(result.products).toHaveLength(0);
	});

	it("returns sales by product from controller", async () => {
		const products: ProductSalesStats[] = [
			{ productId: "prod-1", revenue: 50000, orders: 20, averageValue: 2500 },
			{ productId: "prod-2", revenue: 30000, orders: 12, averageValue: 2500 },
		];
		const ctrl = makeController({
			getSalesByProduct: vi.fn().mockResolvedValue(products),
		});
		const result = (await call(salesByProductHandler, {
			controller: ctrl,
		})) as { products: ProductSalesStats[] };
		expect(result.products).toHaveLength(2);
		expect(result.products[0].revenue).toBe(50000);
		expect(result.products[1].orders).toBe(12);
	});
});

// ── admin GET /analytics/search ───────────────────────────────────────────────

describe("admin GET /analytics/search", () => {
	it("returns zero-state search analytics", async () => {
		const result = (await call(searchHandler)) as {
			analytics: SearchAnalytics;
		};
		expect(result.analytics.totalSearches).toBe(0);
		expect(result.analytics.uniqueQueries).toBe(0);
		expect(result.analytics.topQueries).toHaveLength(0);
	});

	it("returns search analytics from controller", async () => {
		const analytics = makeSearchAnalytics({
			totalSearches: 500,
			uniqueQueries: 120,
			zeroResultCount: 30,
			topQueries: [
				{
					query: "blue shirt",
					count: 45,
					avgResultCount: 8,
					lastSearchedAt: new Date(),
				},
			],
			zeroResultQueries: [
				{
					query: "unobtainium",
					count: 5,
					avgResultCount: 0,
					lastSearchedAt: new Date(),
				},
			],
		});
		const ctrl = makeController({
			getSearchAnalytics: vi.fn().mockResolvedValue(analytics),
		});
		const result = (await call(searchHandler, { controller: ctrl })) as {
			analytics: SearchAnalytics;
		};
		expect(result.analytics.totalSearches).toBe(500);
		expect(result.analytics.uniqueQueries).toBe(120);
		expect(result.analytics.zeroResultCount).toBe(30);
		expect(result.analytics.topQueries[0].query).toBe("blue shirt");
		expect(result.analytics.zeroResultQueries[0].query).toBe("unobtainium");
	});
});

// ── admin GET /analytics/settings ────────────────────────────────────────────

describe("admin GET /analytics/settings", () => {
	it("returns not_configured for all providers when options are empty", async () => {
		const result = (await call(settingsHandler)) as {
			gtm: {
				configured: boolean;
				provider: string;
				containerId: string | null;
			};
			ga4: {
				status: string;
				configured: boolean;
				provider: string;
				measurementId: string | null;
			};
			sentry: {
				status: string;
				configured: boolean;
				provider: string;
				dsn: string | null;
				host: string | null;
			};
		};
		expect(result.gtm.configured).toBe(false);
		expect(result.gtm.provider).toBe("google-tag-manager");
		expect(result.gtm.containerId).toBeNull();
		expect(result.ga4.status).toBe("not_configured");
		expect(result.ga4.configured).toBe(false);
		expect(result.ga4.provider).toBe("ga4-measurement-protocol");
		expect(result.ga4.measurementId).toBeNull();
		expect(result.sentry.status).toBe("not_configured");
		expect(result.sentry.configured).toBe(false);
		expect(result.sentry.provider).toBe("sentry");
		expect(result.sentry.dsn).toBeNull();
		expect(result.sentry.host).toBeNull();
	});

	it("shows gtm as configured when containerId is provided", async () => {
		const handler = extractHandler(
			createGetSettingsEndpoint({ gtmContainerId: "GTM-ABCDE" }),
		);
		const result = (await call(handler)) as {
			gtm: { configured: boolean; containerId: string | null };
		};
		expect(result.gtm.configured).toBe(true);
		expect(result.gtm.containerId).toBe("GTM-ABCDE");
	});
});
