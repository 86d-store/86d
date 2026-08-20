import type { ModuleController } from "@86d-app/core/types/module";

/** Built-in event types — any string is also valid for custom events. */
export type EventType =
	| "pageView"
	| "productView"
	| "addToCart"
	| "removeFromCart"
	| "checkout"
	| "purchase"
	| "search"
	| (string & {});

export type AnalyticsEvent = {
	id: string;
	type: EventType;
	sessionId?: string | undefined;
	customerId?: string | undefined;
	productId?: string | undefined;
	orderId?: string | undefined;
	/** Numeric value associated with the event (e.g. purchase amount in cents). */
	value?: number | undefined;
	/** Arbitrary event payload. */
	data: Record<string, unknown>;
	createdAt: Date;
};

export type EventStats = {
	type: string;
	count: number;
};

export type ProductStats = {
	productId: string;
	views: number;
	purchases: number;
};

export type RevenueSummary = {
	/** Total revenue in cents for the period. */
	totalRevenue: number;
	/** Number of purchase events. */
	orderCount: number;
	/** Average order value in cents (totalRevenue / orderCount). */
	averageOrderValue: number;
	/** Total revenue in the previous period of equal length (for comparison). */
	previousRevenue: number;
	/** Number of purchase events in the previous period. */
	previousOrders: number;
};

export type RevenueTimeSeriesPoint = {
	/** ISO date string (YYYY-MM-DD). */
	date: string;
	/** Revenue in cents for this day. */
	revenue: number;
	/** Number of purchase events this day. */
	orders: number;
};

export type FunnelStep = {
	/** Step name (e.g. "pageView", "productView"). */
	step: string;
	/** Absolute count of events at this step. */
	count: number;
	/** Percentage relative to the first step (0-100). */
	rate: number;
};

export type ProductSalesStats = {
	productId: string;
	/** Total revenue from purchase events in cents. */
	revenue: number;
	/** Number of purchase events. */
	orders: number;
	/** Average value per purchase in cents. */
	averageValue: number;
};

export type SearchQueryStats = {
	/** The search query string. */
	query: string;
	/** Number of times this query was searched. */
	count: number;
	/** Average number of results returned (0 for zero-result queries). */
	avgResultCount: number;
	/** Most recent time this query was searched. */
	lastSearchedAt: Date;
};

export type RecentlyViewedItem = {
	/** Product ID. */
	productId: string;
	/** Product name from the view event. */
	name: string;
	/** Product slug from the view event. */
	slug: string;
	/** Price in cents from the view event. */
	price: number;
	/** First product image URL (if available). */
	image?: string | undefined;
	/** When the product was last viewed. */
	viewedAt: Date;
};

export type SearchAnalytics = {
	/** Total number of search events in the period. */
	totalSearches: number;
	/** Number of unique query strings. */
	uniqueQueries: number;
	/** Number of queries that returned zero results. */
	zeroResultCount: number;
	/** Top queries ranked by count. */
	topQueries: SearchQueryStats[];
	/** Queries that returned zero results, ranked by count. */
	zeroResultQueries: SearchQueryStats[];
};

export type AnalyticsController = ModuleController & {
	/** Record an analytics event. */
	track(params: {
		type: EventType;
		sessionId?: string | undefined;
		customerId?: string | undefined;
		productId?: string | undefined;
		orderId?: string | undefined;
		value?: number | undefined;
		data?: Record<string, unknown> | undefined;
	}): Promise<AnalyticsEvent>;

	/** List events with optional filters. */
	listEvents(params?: {
		type?: string | undefined;
		productId?: string | undefined;
		customerId?: string | undefined;
		sessionId?: string | undefined;
		since?: Date | undefined;
		until?: Date | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<AnalyticsEvent[]>;

	/** Get event counts grouped by type. */
	getStats(params?: {
		since?: Date | undefined;
		until?: Date | undefined;
	}): Promise<EventStats[]>;

	/** Get most-viewed and most-purchased products. */
	getTopProducts(params?: {
		limit?: number | undefined;
		since?: Date | undefined;
		until?: Date | undefined;
	}): Promise<ProductStats[]>;

	/** Get revenue summary with period-over-period comparison. */
	getRevenueSummary(params?: {
		since?: Date | undefined;
		until?: Date | undefined;
	}): Promise<RevenueSummary>;

	/** Get daily revenue time series for charting. */
	getRevenueTimeSeries(params?: {
		since?: Date | undefined;
		until?: Date | undefined;
	}): Promise<RevenueTimeSeriesPoint[]>;

	/** Get conversion funnel step counts. */
	getConversionFunnel(params?: {
		since?: Date | undefined;
		until?: Date | undefined;
	}): Promise<FunnelStep[]>;

	/** Get products ranked by revenue. */
	getSalesByProduct(params?: {
		limit?: number | undefined;
		since?: Date | undefined;
		until?: Date | undefined;
	}): Promise<ProductSalesStats[]>;

	/** Get search analytics with top queries and zero-result queries. */
	getSearchAnalytics(params?: {
		limit?: number | undefined;
		since?: Date | undefined;
		until?: Date | undefined;
	}): Promise<SearchAnalytics>;

	/** Get recently viewed products for a session or customer. */
	getRecentlyViewed(params: {
		sessionId?: string | undefined;
		customerId?: string | undefined;
		/** Product ID to exclude (the one currently being viewed). */
		excludeProductId?: string | undefined;
		/** Max items to return (default: 8). */
		limit?: number | undefined;
	}): Promise<RecentlyViewedItem[]>;
};
