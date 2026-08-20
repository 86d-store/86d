import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAnalyticsController } from "../service-impl";

describe("createAnalyticsController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAnalyticsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAnalyticsController(mockData);
	});

	// ── track ────────────────────────────────────────────────────────────

	describe("track", () => {
		it("records an event with required fields", async () => {
			const event = await controller.track({ type: "pageView" });
			expect(event.id).toBeDefined();
			expect(event.type).toBe("pageView");
			expect(event.data).toEqual({});
			expect(event.createdAt).toBeInstanceOf(Date);
		});

		it("records an event with all optional fields", async () => {
			const event = await controller.track({
				type: "purchase",
				sessionId: "sess_1",
				customerId: "cust_1",
				productId: "prod_1",
				orderId: "ord_1",
				value: 5000,
				data: { source: "checkout" },
			});
			expect(event.sessionId).toBe("sess_1");
			expect(event.customerId).toBe("cust_1");
			expect(event.productId).toBe("prod_1");
			expect(event.orderId).toBe("ord_1");
			expect(event.value).toBe(5000);
			expect(event.data).toEqual({ source: "checkout" });
		});

		it("does not set optional fields when not provided", async () => {
			const event = await controller.track({ type: "pageView" });
			expect(event.sessionId).toBeUndefined();
			expect(event.customerId).toBeUndefined();
			expect(event.productId).toBeUndefined();
			expect(event.value).toBeUndefined();
		});

		it("records custom event types", async () => {
			const event = await controller.track({ type: "customEvent" });
			expect(event.type).toBe("customEvent");
		});
	});

	// ── listEvents ───────────────────────────────────────────────────────

	describe("listEvents", () => {
		it("lists all events without filters", async () => {
			await controller.track({ type: "pageView" });
			await controller.track({ type: "productView" });
			const events = await controller.listEvents();
			expect(events).toHaveLength(2);
		});

		it("filters by type", async () => {
			await controller.track({ type: "pageView" });
			await controller.track({ type: "productView" });
			await controller.track({ type: "pageView" });
			const events = await controller.listEvents({ type: "pageView" });
			expect(events).toHaveLength(2);
		});

		it("filters by productId", async () => {
			await controller.track({
				type: "productView",
				productId: "prod_1",
			});
			await controller.track({
				type: "productView",
				productId: "prod_2",
			});
			const events = await controller.listEvents({
				productId: "prod_1",
			});
			expect(events).toHaveLength(1);
		});

		it("filters by customerId", async () => {
			await controller.track({
				type: "pageView",
				customerId: "cust_1",
			});
			await controller.track({
				type: "pageView",
				customerId: "cust_2",
			});
			const events = await controller.listEvents({
				customerId: "cust_1",
			});
			expect(events).toHaveLength(1);
		});

		it("filters by sessionId", async () => {
			await controller.track({
				type: "pageView",
				sessionId: "sess_1",
			});
			await controller.track({
				type: "pageView",
				sessionId: "sess_2",
			});
			const events = await controller.listEvents({
				sessionId: "sess_1",
			});
			expect(events).toHaveLength(1);
		});

		it("filters by date range", async () => {
			const past = new Date("2024-01-01");
			const future = new Date("2030-01-01");
			await controller.track({ type: "pageView" });
			const events = await controller.listEvents({
				since: past,
				until: future,
			});
			expect(events).toHaveLength(1);
		});

		it("excludes events outside date range", async () => {
			await controller.track({ type: "pageView" });
			const events = await controller.listEvents({
				since: new Date("2030-01-01"),
			});
			expect(events).toHaveLength(0);
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.track({ type: "pageView" });
			}
			const events = await controller.listEvents({ take: 2, skip: 1 });
			expect(events).toHaveLength(2);
		});
	});

	// ── getStats ─────────────────────────────────────────────────────────

	describe("getStats", () => {
		it("returns event counts grouped by type", async () => {
			await controller.track({ type: "pageView" });
			await controller.track({ type: "pageView" });
			await controller.track({ type: "productView" });
			await controller.track({ type: "purchase" });
			const stats = await controller.getStats();
			expect(stats).toHaveLength(3);
			const pageViews = stats.find((s) => s.type === "pageView");
			expect(pageViews?.count).toBe(2);
		});

		it("sorts by count descending", async () => {
			await controller.track({ type: "pageView" });
			await controller.track({ type: "pageView" });
			await controller.track({ type: "pageView" });
			await controller.track({ type: "purchase" });
			const stats = await controller.getStats();
			expect(stats[0].type).toBe("pageView");
			expect(stats[0].count).toBe(3);
		});

		it("returns empty array when no events", async () => {
			const stats = await controller.getStats();
			expect(stats).toHaveLength(0);
		});

		it("respects date range filter", async () => {
			await controller.track({ type: "pageView" });
			const stats = await controller.getStats({
				since: new Date("2030-01-01"),
			});
			expect(stats).toHaveLength(0);
		});
	});

	// ── getTopProducts ───────────────────────────────────────────────────

	describe("getTopProducts", () => {
		it("returns top products by views and purchases", async () => {
			await controller.track({
				type: "productView",
				productId: "prod_1",
			});
			await controller.track({
				type: "productView",
				productId: "prod_1",
			});
			await controller.track({
				type: "purchase",
				productId: "prod_1",
			});
			await controller.track({
				type: "productView",
				productId: "prod_2",
			});

			const top = await controller.getTopProducts();
			expect(top).toHaveLength(2);
			expect(top[0].productId).toBe("prod_1");
			expect(top[0].views).toBe(2);
			expect(top[0].purchases).toBe(1);
		});

		it("ignores events without productId", async () => {
			await controller.track({ type: "pageView" });
			await controller.track({
				type: "productView",
				productId: "prod_1",
			});
			const top = await controller.getTopProducts();
			expect(top).toHaveLength(1);
		});

		it("respects limit parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.track({
					type: "productView",
					productId: `prod_${i}`,
				});
			}
			const top = await controller.getTopProducts({ limit: 3 });
			expect(top).toHaveLength(3);
		});

		it("returns empty array when no product events", async () => {
			await controller.track({ type: "pageView" });
			const top = await controller.getTopProducts();
			expect(top).toHaveLength(0);
		});
	});

	// ── getRevenueSummary ────────────────────────────────────────────────

	describe("getRevenueSummary", () => {
		it("computes revenue metrics from purchase events", async () => {
			await controller.track({
				type: "purchase",
				value: 3000,
				productId: "prod_1",
			});
			await controller.track({
				type: "purchase",
				value: 5000,
				productId: "prod_2",
			});
			await controller.track({ type: "pageView" }); // should be ignored

			const summary = await controller.getRevenueSummary();
			expect(summary.totalRevenue).toBe(8000);
			expect(summary.orderCount).toBe(2);
			expect(summary.averageOrderValue).toBe(4000);
		});

		it("returns zeros when no purchase events", async () => {
			await controller.track({ type: "pageView" });
			const summary = await controller.getRevenueSummary();
			expect(summary.totalRevenue).toBe(0);
			expect(summary.orderCount).toBe(0);
			expect(summary.averageOrderValue).toBe(0);
		});

		it("computes previous period comparison", async () => {
			const now = new Date();
			const oneDay = 24 * 60 * 60 * 1000;
			const since = new Date(now.getTime() - oneDay);
			const until = new Date(now.getTime() + oneDay);

			await controller.track({ type: "purchase", value: 1000 });
			const summary = await controller.getRevenueSummary({
				since,
				until,
			});
			expect(summary.totalRevenue).toBe(1000);
			expect(summary.previousRevenue).toBe(0);
		});
	});

	// ── getRevenueTimeSeries ─────────────────────────────────────────────

	describe("getRevenueTimeSeries", () => {
		it("groups purchase events by date", async () => {
			await controller.track({
				type: "purchase",
				value: 3000,
				productId: "prod_1",
			});
			await controller.track({
				type: "purchase",
				value: 2000,
				productId: "prod_2",
			});

			const series = await controller.getRevenueTimeSeries();
			expect(series).toHaveLength(1); // Same day
			expect(series[0].revenue).toBe(5000);
			expect(series[0].orders).toBe(2);
			expect(series[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		});

		it("returns empty array when no purchase events", async () => {
			await controller.track({ type: "pageView" });
			const series = await controller.getRevenueTimeSeries();
			expect(series).toHaveLength(0);
		});

		it("ignores non-purchase events", async () => {
			await controller.track({ type: "pageView" });
			await controller.track({
				type: "purchase",
				value: 1000,
				productId: "p",
			});
			const series = await controller.getRevenueTimeSeries();
			expect(series).toHaveLength(1);
			expect(series[0].revenue).toBe(1000);
		});
	});

	// ── getConversionFunnel ──────────────────────────────────────────────

	describe("getConversionFunnel", () => {
		it("computes conversion funnel steps", async () => {
			// Session 1: full funnel
			await controller.track({
				type: "pageView",
				sessionId: "s1",
			});
			await controller.track({
				type: "productView",
				sessionId: "s1",
				productId: "p1",
			});
			await controller.track({
				type: "addToCart",
				sessionId: "s1",
				productId: "p1",
			});
			await controller.track({
				type: "checkout",
				sessionId: "s1",
			});
			await controller.track({
				type: "purchase",
				sessionId: "s1",
				value: 5000,
			});

			// Session 2: drops at addToCart
			await controller.track({
				type: "pageView",
				sessionId: "s2",
			});
			await controller.track({
				type: "productView",
				sessionId: "s2",
				productId: "p2",
			});
			await controller.track({
				type: "addToCart",
				sessionId: "s2",
				productId: "p2",
			});

			// Session 3: only pageView
			await controller.track({
				type: "pageView",
				sessionId: "s3",
			});

			const funnel = await controller.getConversionFunnel();
			expect(funnel).toHaveLength(5);

			expect(funnel[0].step).toBe("pageView");
			expect(funnel[0].count).toBe(3);
			expect(funnel[0].rate).toBe(100);

			expect(funnel[1].step).toBe("productView");
			expect(funnel[1].count).toBe(2);
			expect(funnel[1].rate).toBe(67);

			expect(funnel[2].step).toBe("addToCart");
			expect(funnel[2].count).toBe(2);
			expect(funnel[2].rate).toBe(67);

			expect(funnel[3].step).toBe("checkout");
			expect(funnel[3].count).toBe(1);
			expect(funnel[3].rate).toBe(33);

			expect(funnel[4].step).toBe("purchase");
			expect(funnel[4].count).toBe(1);
			expect(funnel[4].rate).toBe(33);
		});

		it("returns all zeros when no events", async () => {
			const funnel = await controller.getConversionFunnel();
			expect(funnel).toHaveLength(5);
			for (const step of funnel) {
				expect(step.count).toBe(0);
				expect(step.rate).toBe(0);
			}
		});

		it("uses customerId as session fallback", async () => {
			await controller.track({
				type: "pageView",
				customerId: "cust_1",
			});
			await controller.track({
				type: "productView",
				customerId: "cust_1",
				productId: "p1",
			});
			const funnel = await controller.getConversionFunnel();
			expect(funnel[0].count).toBe(1);
			expect(funnel[1].count).toBe(1);
		});
	});

	// ── getSalesByProduct ────────────────────────────────────────────────

	describe("getSalesByProduct", () => {
		it("ranks products by revenue", async () => {
			await controller.track({
				type: "purchase",
				productId: "prod_1",
				value: 5000,
			});
			await controller.track({
				type: "purchase",
				productId: "prod_1",
				value: 3000,
			});
			await controller.track({
				type: "purchase",
				productId: "prod_2",
				value: 10000,
			});

			const sales = await controller.getSalesByProduct();
			expect(sales).toHaveLength(2);
			expect(sales[0].productId).toBe("prod_2");
			expect(sales[0].revenue).toBe(10000);
			expect(sales[0].orders).toBe(1);
			expect(sales[0].averageValue).toBe(10000);

			expect(sales[1].productId).toBe("prod_1");
			expect(sales[1].revenue).toBe(8000);
			expect(sales[1].orders).toBe(2);
			expect(sales[1].averageValue).toBe(4000);
		});

		it("ignores events without productId", async () => {
			await controller.track({ type: "purchase", value: 1000 });
			const sales = await controller.getSalesByProduct();
			expect(sales).toHaveLength(0);
		});

		it("respects limit parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.track({
					type: "purchase",
					productId: `prod_${i}`,
					value: 1000,
				});
			}
			const sales = await controller.getSalesByProduct({ limit: 3 });
			expect(sales).toHaveLength(3);
		});

		it("ignores non-purchase events", async () => {
			await controller.track({
				type: "productView",
				productId: "prod_1",
			});
			const sales = await controller.getSalesByProduct();
			expect(sales).toHaveLength(0);
		});

		it("returns empty array when no events", async () => {
			const sales = await controller.getSalesByProduct();
			expect(sales).toHaveLength(0);
		});
	});

	// ── getSearchAnalytics ───────────────────────────────────────────────

	describe("getSearchAnalytics", () => {
		it("returns empty analytics when no search events", async () => {
			const analytics = await controller.getSearchAnalytics();
			expect(analytics.totalSearches).toBe(0);
			expect(analytics.uniqueQueries).toBe(0);
			expect(analytics.zeroResultCount).toBe(0);
			expect(analytics.topQueries).toHaveLength(0);
			expect(analytics.zeroResultQueries).toHaveLength(0);
		});

		it("counts total searches and unique queries", async () => {
			await controller.track({
				type: "search",
				data: { query: "shoes", resultCount: 10 },
			});
			await controller.track({
				type: "search",
				data: { query: "shoes", resultCount: 10 },
			});
			await controller.track({
				type: "search",
				data: { query: "boots", resultCount: 5 },
			});

			const analytics = await controller.getSearchAnalytics();
			expect(analytics.totalSearches).toBe(3);
			expect(analytics.uniqueQueries).toBe(2);
		});

		it("ranks top queries by count descending", async () => {
			await controller.track({
				type: "search",
				data: { query: "jacket", resultCount: 3 },
			});
			for (let i = 0; i < 5; i++) {
				await controller.track({
					type: "search",
					data: { query: "shoes", resultCount: 10 },
				});
			}
			await controller.track({
				type: "search",
				data: { query: "hat", resultCount: 2 },
			});
			await controller.track({
				type: "search",
				data: { query: "hat", resultCount: 2 },
			});

			const analytics = await controller.getSearchAnalytics();
			expect(analytics.topQueries[0].query).toBe("shoes");
			expect(analytics.topQueries[0].count).toBe(5);
			expect(analytics.topQueries[1].query).toBe("hat");
			expect(analytics.topQueries[1].count).toBe(2);
			expect(analytics.topQueries[2].query).toBe("jacket");
			expect(analytics.topQueries[2].count).toBe(1);
		});

		it("computes average result count", async () => {
			await controller.track({
				type: "search",
				data: { query: "shoes", resultCount: 10 },
			});
			await controller.track({
				type: "search",
				data: { query: "shoes", resultCount: 20 },
			});

			const analytics = await controller.getSearchAnalytics();
			expect(analytics.topQueries[0].avgResultCount).toBe(15);
		});

		it("identifies zero-result queries", async () => {
			await controller.track({
				type: "search",
				data: { query: "nonexistent", resultCount: 0 },
			});
			await controller.track({
				type: "search",
				data: { query: "nonexistent", resultCount: 0 },
			});
			await controller.track({
				type: "search",
				data: { query: "shoes", resultCount: 10 },
			});

			const analytics = await controller.getSearchAnalytics();
			expect(analytics.zeroResultQueries).toHaveLength(1);
			expect(analytics.zeroResultQueries[0].query).toBe("nonexistent");
			expect(analytics.zeroResultQueries[0].count).toBe(2);
			expect(analytics.zeroResultCount).toBe(2);
		});

		it("normalizes query strings (case-insensitive, trimmed)", async () => {
			await controller.track({
				type: "search",
				data: { query: "Shoes", resultCount: 5 },
			});
			await controller.track({
				type: "search",
				data: { query: " shoes ", resultCount: 5 },
			});
			await controller.track({
				type: "search",
				data: { query: "SHOES", resultCount: 5 },
			});

			const analytics = await controller.getSearchAnalytics();
			expect(analytics.uniqueQueries).toBe(1);
			expect(analytics.topQueries[0].query).toBe("shoes");
			expect(analytics.topQueries[0].count).toBe(3);
		});

		it("ignores non-search events", async () => {
			await controller.track({ type: "pageView" });
			await controller.track({ type: "purchase", value: 1000 });
			await controller.track({
				type: "search",
				data: { query: "shoes", resultCount: 5 },
			});

			const analytics = await controller.getSearchAnalytics();
			expect(analytics.totalSearches).toBe(1);
			expect(analytics.topQueries).toHaveLength(1);
		});

		it("ignores search events with empty query", async () => {
			await controller.track({
				type: "search",
				data: { query: "", resultCount: 0 },
			});
			await controller.track({
				type: "search",
				data: { query: "   ", resultCount: 0 },
			});
			await controller.track({
				type: "search",
				data: { query: "shoes", resultCount: 5 },
			});

			const analytics = await controller.getSearchAnalytics();
			expect(analytics.uniqueQueries).toBe(1);
			expect(analytics.topQueries).toHaveLength(1);
		});

		it("respects limit parameter", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.track({
					type: "search",
					data: { query: `query_${i}`, resultCount: i },
				});
			}

			const analytics = await controller.getSearchAnalytics({ limit: 5 });
			expect(analytics.topQueries.length).toBeLessThanOrEqual(5);
		});

		it("respects date range filter", async () => {
			await controller.track({
				type: "search",
				data: { query: "shoes", resultCount: 5 },
			});

			const analytics = await controller.getSearchAnalytics({
				since: new Date("2030-01-01"),
			});
			expect(analytics.totalSearches).toBe(0);
		});

		it("tracks lastSearchedAt correctly", async () => {
			await controller.track({
				type: "search",
				data: { query: "shoes", resultCount: 5 },
			});

			const analytics = await controller.getSearchAnalytics();
			expect(analytics.topQueries[0].lastSearchedAt).toBeDefined();
			const searchDate = new Date(analytics.topQueries[0].lastSearchedAt);
			expect(searchDate.getTime()).toBeGreaterThan(0);
		});

		it("handles search events without resultCount gracefully", async () => {
			await controller.track({
				type: "search",
				data: { query: "shoes", source: "search_page" },
			});

			const analytics = await controller.getSearchAnalytics();
			expect(analytics.totalSearches).toBe(1);
			expect(analytics.topQueries[0].avgResultCount).toBe(0);
		});
	});

	// ── getRecentlyViewed ───────────────────────────────────────────────

	describe("getRecentlyViewed", () => {
		it("returns recently viewed products for a session", async () => {
			await controller.track({
				type: "productView",
				sessionId: "sess_1",
				productId: "prod_1",
				data: { name: "Widget", slug: "widget", price: 1999 },
			});
			await controller.track({
				type: "productView",
				sessionId: "sess_1",
				productId: "prod_2",
				data: {
					name: "Gadget",
					slug: "gadget",
					price: 2999,
					image: "https://img.example.com/gadget.jpg",
				},
			});

			const items = await controller.getRecentlyViewed({
				sessionId: "sess_1",
			});
			expect(items).toHaveLength(2);
			expect(items[0].name).toBe("Gadget");
			expect(items[0].image).toBe("https://img.example.com/gadget.jpg");
			expect(items[1].name).toBe("Widget");
			expect(items[1].image).toBeUndefined();
		});

		it("deduplicates by productId keeping most recent", async () => {
			await controller.track({
				type: "productView",
				sessionId: "sess_1",
				productId: "prod_1",
				data: { name: "Widget v1", slug: "widget", price: 1999 },
			});
			await controller.track({
				type: "productView",
				sessionId: "sess_1",
				productId: "prod_2",
				data: { name: "Gadget", slug: "gadget", price: 2999 },
			});
			await controller.track({
				type: "productView",
				sessionId: "sess_1",
				productId: "prod_1",
				data: { name: "Widget v2", slug: "widget", price: 2499 },
			});

			const items = await controller.getRecentlyViewed({
				sessionId: "sess_1",
			});
			expect(items).toHaveLength(2);
			// Most recent view of prod_1 should win
			expect(items[0].name).toBe("Widget v2");
			expect(items[0].price).toBe(2499);
		});

		it("excludes a specific product", async () => {
			await controller.track({
				type: "productView",
				sessionId: "sess_1",
				productId: "prod_1",
				data: { name: "Widget", slug: "widget", price: 1999 },
			});
			await controller.track({
				type: "productView",
				sessionId: "sess_1",
				productId: "prod_2",
				data: { name: "Gadget", slug: "gadget", price: 2999 },
			});

			const items = await controller.getRecentlyViewed({
				sessionId: "sess_1",
				excludeProductId: "prod_2",
			});
			expect(items).toHaveLength(1);
			expect(items[0].productId).toBe("prod_1");
		});

		it("respects limit parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.track({
					type: "productView",
					sessionId: "sess_1",
					productId: `prod_${i}`,
					data: { name: `Product ${i}`, slug: `product-${i}`, price: 1000 },
				});
			}

			const items = await controller.getRecentlyViewed({
				sessionId: "sess_1",
				limit: 3,
			});
			expect(items).toHaveLength(3);
		});

		it("defaults to limit of 8", async () => {
			for (let i = 0; i < 12; i++) {
				await controller.track({
					type: "productView",
					sessionId: "sess_1",
					productId: `prod_${i}`,
					data: { name: `Product ${i}`, slug: `p-${i}`, price: 1000 },
				});
			}

			const items = await controller.getRecentlyViewed({
				sessionId: "sess_1",
			});
			expect(items).toHaveLength(8);
		});

		it("filters by customerId", async () => {
			await controller.track({
				type: "productView",
				customerId: "cust_1",
				productId: "prod_1",
				data: { name: "Widget", slug: "widget", price: 1999 },
			});
			await controller.track({
				type: "productView",
				customerId: "cust_2",
				productId: "prod_2",
				data: { name: "Gadget", slug: "gadget", price: 2999 },
			});

			const items = await controller.getRecentlyViewed({
				customerId: "cust_1",
			});
			expect(items).toHaveLength(1);
			expect(items[0].productId).toBe("prod_1");
		});

		it("returns empty array when no productView events", async () => {
			await controller.track({
				type: "pageView",
				sessionId: "sess_1",
			});

			const items = await controller.getRecentlyViewed({
				sessionId: "sess_1",
			});
			expect(items).toHaveLength(0);
		});

		it("ignores events without productId", async () => {
			await controller.track({
				type: "productView",
				sessionId: "sess_1",
				data: { name: "Broken", slug: "broken", price: 0 },
			});
			await controller.track({
				type: "productView",
				sessionId: "sess_1",
				productId: "prod_1",
				data: { name: "Widget", slug: "widget", price: 1999 },
			});

			const items = await controller.getRecentlyViewed({
				sessionId: "sess_1",
			});
			expect(items).toHaveLength(1);
			expect(items[0].productId).toBe("prod_1");
		});

		it("handles missing event data gracefully", async () => {
			await controller.track({
				type: "productView",
				sessionId: "sess_1",
				productId: "prod_1",
			});

			const items = await controller.getRecentlyViewed({
				sessionId: "sess_1",
			});
			expect(items).toHaveLength(1);
			expect(items[0].name).toBe("Product");
			expect(items[0].slug).toBe("prod_1");
			expect(items[0].price).toBe(0);
		});

		it("returns items sorted by most recent first", async () => {
			await controller.track({
				type: "productView",
				sessionId: "sess_1",
				productId: "prod_a",
				data: { name: "First", slug: "first", price: 1000 },
			});
			await controller.track({
				type: "productView",
				sessionId: "sess_1",
				productId: "prod_b",
				data: { name: "Second", slug: "second", price: 2000 },
			});
			await controller.track({
				type: "productView",
				sessionId: "sess_1",
				productId: "prod_c",
				data: { name: "Third", slug: "third", price: 3000 },
			});

			const items = await controller.getRecentlyViewed({
				sessionId: "sess_1",
			});
			expect(items[0].name).toBe("Third");
			expect(items[1].name).toBe("Second");
			expect(items[2].name).toBe("First");
		});

		it("returns empty when no matching session", async () => {
			await controller.track({
				type: "productView",
				sessionId: "sess_1",
				productId: "prod_1",
				data: { name: "Widget", slug: "widget", price: 1999 },
			});

			const items = await controller.getRecentlyViewed({
				sessionId: "sess_other",
			});
			expect(items).toHaveLength(0);
		});
	});
});
