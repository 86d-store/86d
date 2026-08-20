import type { ModuleDataService } from "@86d-app/core/types/module";
import type { GA4Provider } from "./providers/ga4";
import type {
	AnalyticsController,
	AnalyticsEvent,
	EventStats,
	FunnelStep,
	ProductSalesStats,
	ProductStats,
	RecentlyViewedItem,
	RevenueTimeSeriesPoint,
	SearchAnalytics,
	SearchQueryStats,
} from "./service";

/** Filter events by optional since/until dates. */
function filterByDateRange(
	events: AnalyticsEvent[],
	since?: Date | undefined,
	until?: Date | undefined,
): AnalyticsEvent[] {
	let result = events;
	if (since !== undefined) {
		result = result.filter((e) => new Date(e.createdAt) >= since);
	}
	if (until !== undefined) {
		result = result.filter((e) => new Date(e.createdAt) <= until);
	}
	return result;
}

/** Format a Date to YYYY-MM-DD string. */
function toDateKey(d: Date): string {
	return d.toISOString().slice(0, 10);
}

export function createAnalyticsController(
	data: ModuleDataService,
	ga4Provider?: GA4Provider | undefined,
): AnalyticsController {
	return {
		async track(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const event: AnalyticsEvent = {
				id,
				type: params.type,
				...(params.sessionId !== undefined
					? { sessionId: params.sessionId }
					: {}),
				...(params.customerId !== undefined
					? { customerId: params.customerId }
					: {}),
				...(params.productId !== undefined
					? { productId: params.productId }
					: {}),
				...(params.orderId !== undefined ? { orderId: params.orderId } : {}),
				...(params.value !== undefined ? { value: params.value } : {}),
				data: params.data ?? {},
				createdAt: now,
			};
			await data.upsert("event", id, event as Record<string, unknown>);

			// Forward to GA4 Measurement Protocol (fire-and-forget)
			if (ga4Provider) {
				const ga4Event = ga4Provider.mapEvent(params);
				const clientId = params.customerId ?? params.sessionId ?? id;
				ga4Provider
					.send({
						clientId,
						userId: params.customerId,
						events: [ga4Event],
					})
					.catch(() => {
						// Swallow — analytics forwarding is best-effort
					});
			}

			return event;
		},

		async listEvents(params) {
			// Push equality filters to DB where clause; date range stays client-side
			const where: Record<string, unknown> = {};
			if (params?.type !== undefined) where.type = params.type;
			if (params?.productId !== undefined) where.productId = params.productId;
			if (params?.customerId !== undefined)
				where.customerId = params.customerId;
			if (params?.sessionId !== undefined) where.sessionId = params.sessionId;

			const all = await data.findMany("event", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return filterByDateRange(
				all as unknown as AnalyticsEvent[],
				params?.since,
				params?.until,
			);
		},

		async getStats(params) {
			const all = await data.findMany("event");
			const events = filterByDateRange(
				all as unknown as AnalyticsEvent[],
				params?.since,
				params?.until,
			);

			const counts = new Map<string, number>();
			for (const event of events) {
				counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
			}
			return (Array.from(counts.entries()) as [string, number][])
				.map(([type, count]): EventStats => ({ type, count }))
				.sort((a, b) => b.count - a.count);
		},

		async getTopProducts(params) {
			const all = await data.findMany("event");
			const events = filterByDateRange(
				all as unknown as AnalyticsEvent[],
				params?.since,
				params?.until,
			).filter((e) => e.productId !== undefined);

			const stats = new Map<string, { views: number; purchases: number }>();
			for (const event of events) {
				if (event.productId === undefined) continue;
				const existing = stats.get(event.productId) ?? {
					views: 0,
					purchases: 0,
				};
				if (event.type === "productView") {
					existing.views += 1;
				} else if (event.type === "purchase") {
					existing.purchases += 1;
				}
				stats.set(event.productId, existing);
			}

			const limit = params?.limit ?? 10;
			return (
				Array.from(stats.entries()) as [
					string,
					{ views: number; purchases: number },
				][]
			)
				.map(([productId, s]): ProductStats => ({ productId, ...s }))
				.sort((a, b) => b.views + b.purchases - (a.views + a.purchases))
				.slice(0, limit);
		},

		async getRevenueSummary(params) {
			const all = await data.findMany("event");
			const allEvents = all as unknown as AnalyticsEvent[];

			// Determine the period length for previous-period comparison
			const now = new Date();
			const since = params?.since;
			const until = params?.until ?? now;
			const periodMs =
				since !== undefined
					? until.getTime() - since.getTime()
					: until.getTime();

			// Current period
			const current = filterByDateRange(allEvents, since, until).filter(
				(e) => e.type === "purchase",
			);
			const totalRevenue = current.reduce((sum, e) => sum + (e.value ?? 0), 0);
			const orderCount = current.length;
			const averageOrderValue =
				orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

			// Previous period (same length, ending at since)
			let previousRevenue = 0;
			let previousOrders = 0;
			if (since !== undefined && periodMs > 0) {
				const prevStart = new Date(since.getTime() - periodMs);
				const prev = filterByDateRange(allEvents, prevStart, since).filter(
					(e) => e.type === "purchase",
				);
				previousRevenue = prev.reduce((sum, e) => sum + (e.value ?? 0), 0);
				previousOrders = prev.length;
			}

			return {
				totalRevenue,
				orderCount,
				averageOrderValue,
				previousRevenue,
				previousOrders,
			};
		},

		async getRevenueTimeSeries(params) {
			const all = await data.findMany("event");
			const events = filterByDateRange(
				all as unknown as AnalyticsEvent[],
				params?.since,
				params?.until,
			).filter((e) => e.type === "purchase");

			// Group by date
			const days = new Map<string, { revenue: number; orders: number }>();
			for (const event of events) {
				const key = toDateKey(new Date(event.createdAt));
				const existing = days.get(key) ?? { revenue: 0, orders: 0 };
				existing.revenue += event.value ?? 0;
				existing.orders += 1;
				days.set(key, existing);
			}

			// Fill in missing days between min and max dates
			const sortedKeys = Array.from(days.keys()).sort();
			if (sortedKeys.length === 0) return [];

			const result: RevenueTimeSeriesPoint[] = [];
			const startDate = new Date(`${sortedKeys[0]}T00:00:00Z`);
			const endDate = new Date(
				`${sortedKeys[sortedKeys.length - 1]}T00:00:00Z`,
			);
			const cursor = new Date(startDate);
			while (cursor <= endDate) {
				const key = toDateKey(cursor);
				const entry = days.get(key);
				result.push({
					date: key,
					revenue: entry?.revenue ?? 0,
					orders: entry?.orders ?? 0,
				});
				cursor.setUTCDate(cursor.getUTCDate() + 1);
			}
			return result;
		},

		async getConversionFunnel(params) {
			const all = await data.findMany("event");
			const events = filterByDateRange(
				all as unknown as AnalyticsEvent[],
				params?.since,
				params?.until,
			);

			// Count unique sessions per funnel step
			// A session that has a "purchase" event also counts for "checkout", etc.
			const stepTypes = [
				"pageView",
				"productView",
				"addToCart",
				"checkout",
				"purchase",
			] as const;

			const sessionSteps = new Map<string, Set<string>>();
			for (const event of events) {
				const sessionKey = event.sessionId ?? event.customerId ?? event.id;
				if (!sessionSteps.has(sessionKey)) {
					sessionSteps.set(sessionKey, new Set());
				}
				sessionSteps.get(sessionKey)?.add(event.type);
			}

			const stepCounts: FunnelStep[] = [];
			let firstCount = 0;
			for (const step of stepTypes) {
				let count = 0;
				for (const types of sessionSteps.values()) {
					if (types.has(step)) count++;
				}
				if (stepCounts.length === 0) firstCount = count;
				stepCounts.push({
					step,
					count,
					rate: firstCount > 0 ? Math.round((count / firstCount) * 100) : 0,
				});
			}

			return stepCounts;
		},

		async getSalesByProduct(params) {
			const all = await data.findMany("event");
			const events = filterByDateRange(
				all as unknown as AnalyticsEvent[],
				params?.since,
				params?.until,
			).filter((e) => e.type === "purchase" && e.productId !== undefined);

			const stats = new Map<string, { revenue: number; orders: number }>();
			for (const event of events) {
				if (event.productId === undefined) continue;
				const existing = stats.get(event.productId) ?? {
					revenue: 0,
					orders: 0,
				};
				existing.revenue += event.value ?? 0;
				existing.orders += 1;
				stats.set(event.productId, existing);
			}

			const limit = params?.limit ?? 10;
			return (
				Array.from(stats.entries()) as [
					string,
					{ revenue: number; orders: number },
				][]
			)
				.map(
					([productId, s]): ProductSalesStats => ({
						productId,
						revenue: s.revenue,
						orders: s.orders,
						averageValue: s.orders > 0 ? Math.round(s.revenue / s.orders) : 0,
					}),
				)
				.sort((a, b) => b.revenue - a.revenue)
				.slice(0, limit);
		},

		async getRecentlyViewed(params): Promise<RecentlyViewedItem[]> {
			const where: Record<string, unknown> = { type: "productView" };
			if (params.sessionId !== undefined) where.sessionId = params.sessionId;
			if (params.customerId !== undefined) where.customerId = params.customerId;

			const all = await data.findMany("event", {
				...(Object.keys(where).length > 1 ? { where } : { where }),
			});
			// Reverse to get most-recently-inserted first (findMany returns insertion order).
			// Stable sort by createdAt descending, using array index as tiebreaker.
			const indexed = (all as unknown as AnalyticsEvent[]).map((e, i) => ({
				e,
				i,
			}));
			indexed.sort(
				(a, b) =>
					new Date(b.e.createdAt).getTime() -
						new Date(a.e.createdAt).getTime() || b.i - a.i,
			);
			const events = indexed.map((x) => x.e);

			const limit = params.limit ?? 8;
			const seen = new Set<string>();
			const items: RecentlyViewedItem[] = [];

			for (const event of events) {
				if (!event.productId) continue;
				if (
					params.excludeProductId !== undefined &&
					event.productId === params.excludeProductId
				)
					continue;
				if (seen.has(event.productId)) continue;
				seen.add(event.productId);

				const d = event.data ?? {};
				items.push({
					productId: event.productId,
					name: typeof d.name === "string" ? d.name : "Product",
					slug: typeof d.slug === "string" ? d.slug : event.productId,
					price: typeof d.price === "number" ? d.price : 0,
					image: typeof d.image === "string" ? d.image : undefined,
					viewedAt: new Date(event.createdAt),
				});

				if (items.length >= limit) break;
			}

			return items;
		},

		async getSearchAnalytics(params): Promise<SearchAnalytics> {
			const all = await data.findMany("event");
			const events = filterByDateRange(
				all as unknown as AnalyticsEvent[],
				params?.since,
				params?.until,
			).filter((e) => e.type === "search");

			// Aggregate by query string (lowercased + trimmed for consistency)
			const queryMap = new Map<
				string,
				{ count: number; totalResults: number; lastSearchedAt: Date }
			>();

			for (const event of events) {
				const rawQuery =
					typeof event.data?.query === "string"
						? event.data.query.trim().toLowerCase()
						: "";
				if (!rawQuery) continue;

				const existing = queryMap.get(rawQuery) ?? {
					count: 0,
					totalResults: 0,
					lastSearchedAt: new Date(0),
				};
				existing.count += 1;
				const resultCount =
					typeof event.data?.resultCount === "number"
						? event.data.resultCount
						: -1;
				if (resultCount >= 0) {
					existing.totalResults += resultCount;
				}
				const eventDate = new Date(event.createdAt);
				if (eventDate > existing.lastSearchedAt) {
					existing.lastSearchedAt = eventDate;
				}
				queryMap.set(rawQuery, existing);
			}

			const allQueries: SearchQueryStats[] = Array.from(queryMap.entries()).map(
				([query, stats]) => ({
					query,
					count: stats.count,
					avgResultCount:
						stats.count > 0 ? Math.round(stats.totalResults / stats.count) : 0,
					lastSearchedAt: stats.lastSearchedAt,
				}),
			);

			const topQueries = [...allQueries]
				.sort((a, b) => b.count - a.count)
				.slice(0, params?.limit ?? 20);

			const zeroResultQueries = allQueries
				.filter((q) => q.avgResultCount === 0)
				.sort((a, b) => b.count - a.count)
				.slice(0, params?.limit ?? 20);

			return {
				totalSearches: events.length,
				uniqueQueries: queryMap.size,
				zeroResultCount: zeroResultQueries.reduce((sum, q) => sum + q.count, 0),
				topQueries,
				zeroResultQueries,
			};
		},
	};
}
