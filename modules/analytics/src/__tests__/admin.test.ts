import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAnalyticsController } from "../service-impl";

/**
 * Admin workflow tests for the analytics module.
 *
 * Covers: full customer journeys, revenue analytics, search analytics,
 * product performance, multi-session funnels, date filtering,
 * event pagination, and recently-viewed workflows.
 */

describe("analytics — admin workflows", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAnalyticsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAnalyticsController(mockData);
	});

	// ── Full customer journey tracking ───────────────────────────────

	describe("full customer journey tracking", () => {
		it("tracks a complete conversion flow for a single session", async () => {
			const steps = [
				"pageView",
				"productView",
				"addToCart",
				"checkout",
				"purchase",
			] as const;
			for (const type of steps) {
				await controller.track({
					type,
					sessionId: "sess_journey",
					productId: "prod_a",
					...(type === "purchase" ? { value: 4999 } : {}),
				});
			}
			const events = await controller.listEvents({
				sessionId: "sess_journey",
			});
			expect(events).toHaveLength(5);
			expect(events.map((e) => e.type)).toEqual(
				expect.arrayContaining([...steps]),
			);
		});

		it("shows correct funnel drop-off for a partial journey", async () => {
			// Session that stops at addToCart
			await controller.track({
				type: "pageView",
				sessionId: "sess_partial",
			});
			await controller.track({
				type: "productView",
				sessionId: "sess_partial",
				productId: "prod_a",
			});
			await controller.track({
				type: "addToCart",
				sessionId: "sess_partial",
				productId: "prod_a",
			});

			const funnel = await controller.getConversionFunnel();
			const stepMap = new Map(funnel.map((s) => [s.step, s.count]));
			expect(stepMap.get("pageView")).toBe(1);
			expect(stepMap.get("productView")).toBe(1);
			expect(stepMap.get("addToCart")).toBe(1);
			expect(stepMap.get("checkout")).toBe(0);
			expect(stepMap.get("purchase")).toBe(0);
		});

		it("funnel rates are relative to first step", async () => {
			await controller.track({ type: "pageView", sessionId: "s1" });
			await controller.track({ type: "productView", sessionId: "s1" });
			await controller.track({ type: "pageView", sessionId: "s2" });

			const funnel = await controller.getConversionFunnel();
			const pv = funnel.find((s) => s.step === "pageView");
			const prv = funnel.find((s) => s.step === "productView");
			expect(pv?.rate).toBe(100);
			expect(prv?.rate).toBe(50);
		});

		it("events appear with correct types in list", async () => {
			await controller.track({
				type: "pageView",
				sessionId: "s1",
			});
			await controller.track({
				type: "purchase",
				sessionId: "s1",
				value: 1000,
			});

			const events = await controller.listEvents({ type: "purchase" });
			expect(events).toHaveLength(1);
			expect(events[0]?.type).toBe("purchase");
			expect(events[0]?.value).toBe(1000);
		});

		it("events include all tracked metadata", async () => {
			const event = await controller.track({
				type: "purchase",
				sessionId: "sess_1",
				customerId: "cust_1",
				productId: "prod_1",
				orderId: "ord_1",
				value: 7500,
				data: { coupon: "SAVE10" },
			});
			expect(event.sessionId).toBe("sess_1");
			expect(event.customerId).toBe("cust_1");
			expect(event.productId).toBe("prod_1");
			expect(event.orderId).toBe("ord_1");
			expect(event.data).toEqual({ coupon: "SAVE10" });
		});
	});

	// ── Revenue analytics workflows ──────────────────────────────────

	describe("revenue analytics workflows", () => {
		it("computes total revenue from multiple purchases", async () => {
			await controller.track({
				type: "purchase",
				productId: "p1",
				value: 3000,
			});
			await controller.track({
				type: "purchase",
				productId: "p2",
				value: 5000,
			});
			await controller.track({
				type: "purchase",
				productId: "p3",
				value: 2000,
			});

			const summary = await controller.getRevenueSummary();
			expect(summary.totalRevenue).toBe(10000);
			expect(summary.orderCount).toBe(3);
			expect(summary.averageOrderValue).toBe(Math.round(10000 / 3));
		});

		it("groups revenue by date in time series", async () => {
			await controller.track({
				type: "purchase",
				value: 1000,
			});
			await controller.track({
				type: "purchase",
				value: 2000,
			});

			const series = await controller.getRevenueTimeSeries();
			expect(series.length).toBeGreaterThanOrEqual(1);
			const today = new Date().toISOString().slice(0, 10);
			const todayPoint = series.find((p) => p.date === today);
			expect(todayPoint?.revenue).toBe(3000);
			expect(todayPoint?.orders).toBe(2);
		});

		it("ranks sales by product revenue", async () => {
			await controller.track({
				type: "purchase",
				productId: "p_cheap",
				value: 1000,
			});
			await controller.track({
				type: "purchase",
				productId: "p_expensive",
				value: 9000,
			});
			await controller.track({
				type: "purchase",
				productId: "p_cheap",
				value: 1000,
			});

			const sales = await controller.getSalesByProduct();
			expect(sales[0]?.productId).toBe("p_expensive");
			expect(sales[0]?.revenue).toBe(9000);
			expect(sales[1]?.productId).toBe("p_cheap");
			expect(sales[1]?.revenue).toBe(2000);
			expect(sales[1]?.orders).toBe(2);
			expect(sales[1]?.averageValue).toBe(1000);
		});

		it("computes period-over-period comparison", async () => {
			const now = new Date();
			const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);

			// Previous period purchase (tracked now, but we test with date boundaries)
			// Since the mock tracks at "now", we test that the boundary logic works
			// by setting since=twoDaysAgo so previous period = fourDaysAgo..twoDaysAgo
			await controller.track({ type: "purchase", value: 5000 });

			const summary = await controller.getRevenueSummary({
				since: twoDaysAgo,
				until: now,
			});
			// All events tracked at "now", so they fall in current period
			expect(summary.totalRevenue).toBe(5000);
			expect(summary.previousRevenue).toBe(0);
			expect(summary.previousOrders).toBe(0);
		});

		it("returns zero revenue summary when no purchases exist", async () => {
			await controller.track({ type: "pageView" });

			const summary = await controller.getRevenueSummary();
			expect(summary.totalRevenue).toBe(0);
			expect(summary.orderCount).toBe(0);
			expect(summary.averageOrderValue).toBe(0);
		});

		it("sales by product returns empty array with no purchase events", async () => {
			await controller.track({
				type: "productView",
				productId: "p1",
			});

			const sales = await controller.getSalesByProduct();
			expect(sales).toEqual([]);
		});
	});

	// ── Search analytics workflows ───────────────────────────────────

	describe("search analytics workflows", () => {
		it("aggregates top search queries by frequency", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.track({
					type: "search",
					data: { query: "sneakers", resultCount: 42 },
				});
			}
			for (let i = 0; i < 3; i++) {
				await controller.track({
					type: "search",
					data: { query: "boots", resultCount: 10 },
				});
			}

			const analytics = await controller.getSearchAnalytics();
			expect(analytics.totalSearches).toBe(8);
			expect(analytics.uniqueQueries).toBe(2);
			expect(analytics.topQueries[0]?.query).toBe("sneakers");
			expect(analytics.topQueries[0]?.count).toBe(5);
			expect(analytics.topQueries[1]?.query).toBe("boots");
		});

		it("detects zero-result queries", async () => {
			await controller.track({
				type: "search",
				data: { query: "xylophone case", resultCount: 0 },
			});
			await controller.track({
				type: "search",
				data: { query: "xylophone case", resultCount: 0 },
			});
			await controller.track({
				type: "search",
				data: { query: "shoes", resultCount: 50 },
			});

			const analytics = await controller.getSearchAnalytics();
			expect(analytics.zeroResultQueries).toHaveLength(1);
			expect(analytics.zeroResultQueries[0]?.query).toBe("xylophone case");
			expect(analytics.zeroResultCount).toBe(2);
		});

		it("normalizes query casing and whitespace", async () => {
			await controller.track({
				type: "search",
				data: { query: "Red Shoes", resultCount: 5 },
			});
			await controller.track({
				type: "search",
				data: { query: "  red shoes  ", resultCount: 5 },
			});
			await controller.track({
				type: "search",
				data: { query: "RED SHOES", resultCount: 5 },
			});

			const analytics = await controller.getSearchAnalytics();
			expect(analytics.uniqueQueries).toBe(1);
			expect(analytics.topQueries[0]?.count).toBe(3);
			expect(analytics.topQueries[0]?.query).toBe("red shoes");
		});

		it("respects limit parameter for top queries", async () => {
			const queries = ["alpha", "bravo", "charlie", "delta", "echo"];
			for (const q of queries) {
				await controller.track({
					type: "search",
					data: { query: q, resultCount: 1 },
				});
			}

			const analytics = await controller.getSearchAnalytics({ limit: 2 });
			expect(analytics.topQueries).toHaveLength(2);
			expect(analytics.zeroResultQueries.length).toBeLessThanOrEqual(2);
		});

		it("computes average result count per query", async () => {
			await controller.track({
				type: "search",
				data: { query: "hats", resultCount: 10 },
			});
			await controller.track({
				type: "search",
				data: { query: "hats", resultCount: 20 },
			});

			const analytics = await controller.getSearchAnalytics();
			const hats = analytics.topQueries.find((q) => q.query === "hats");
			expect(hats?.avgResultCount).toBe(15);
		});
	});

	// ── Product performance analysis ─────────────────────────────────

	describe("product performance analysis", () => {
		it("ranks top products by combined views and purchases", async () => {
			// Product A: 10 views, 2 purchases
			for (let i = 0; i < 10; i++) {
				await controller.track({
					type: "productView",
					productId: "prod_a",
				});
			}
			await controller.track({
				type: "purchase",
				productId: "prod_a",
				value: 1000,
			});
			await controller.track({
				type: "purchase",
				productId: "prod_a",
				value: 1000,
			});

			// Product B: 3 views, 0 purchases
			for (let i = 0; i < 3; i++) {
				await controller.track({
					type: "productView",
					productId: "prod_b",
				});
			}

			const top = await controller.getTopProducts();
			expect(top[0]?.productId).toBe("prod_a");
			expect(top[0]?.views).toBe(10);
			expect(top[0]?.purchases).toBe(2);
			expect(top[1]?.productId).toBe("prod_b");
			expect(top[1]?.views).toBe(3);
			expect(top[1]?.purchases).toBe(0);
		});

		it("limits top products results", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.track({
					type: "productView",
					productId: `prod_${i}`,
				});
			}

			const top = await controller.getTopProducts({ limit: 2 });
			expect(top).toHaveLength(2);
		});

		it("handles products with only views and no purchases", async () => {
			await controller.track({
				type: "productView",
				productId: "view_only",
			});

			const top = await controller.getTopProducts();
			const item = top.find((p) => p.productId === "view_only");
			expect(item?.views).toBe(1);
			expect(item?.purchases).toBe(0);
		});

		it("handles products with only purchases and no views", async () => {
			await controller.track({
				type: "purchase",
				productId: "purchase_only",
				value: 5000,
			});

			const top = await controller.getTopProducts();
			const item = top.find((p) => p.productId === "purchase_only");
			expect(item?.views).toBe(0);
			expect(item?.purchases).toBe(1);
		});

		it("computes per-product conversion via sales stats", async () => {
			// 2 purchases for the same product
			await controller.track({
				type: "purchase",
				productId: "prod_conv",
				value: 3000,
			});
			await controller.track({
				type: "purchase",
				productId: "prod_conv",
				value: 5000,
			});

			const sales = await controller.getSalesByProduct();
			const prod = sales.find((s) => s.productId === "prod_conv");
			expect(prod?.orders).toBe(2);
			expect(prod?.revenue).toBe(8000);
			expect(prod?.averageValue).toBe(4000);
		});
	});

	// ── Multi-session funnel analysis ────────────────────────────────

	describe("multi-session funnel analysis", () => {
		it("counts each session independently in the funnel", async () => {
			// Session 1: full journey
			for (const type of [
				"pageView",
				"productView",
				"addToCart",
				"checkout",
				"purchase",
			] as const) {
				await controller.track({ type, sessionId: "s1" });
			}
			// Session 2: drops at productView
			await controller.track({ type: "pageView", sessionId: "s2" });
			await controller.track({
				type: "productView",
				sessionId: "s2",
			});

			const funnel = await controller.getConversionFunnel();
			const stepMap = new Map(funnel.map((s) => [s.step, s.count]));
			expect(stepMap.get("pageView")).toBe(2);
			expect(stepMap.get("productView")).toBe(2);
			expect(stepMap.get("addToCart")).toBe(1);
			expect(stepMap.get("checkout")).toBe(1);
			expect(stepMap.get("purchase")).toBe(1);
		});

		it("funnel rates reflect unique session proportions", async () => {
			// 4 sessions view pages, 2 add to cart, 1 purchases
			for (let i = 0; i < 4; i++) {
				await controller.track({
					type: "pageView",
					sessionId: `s${i}`,
				});
			}
			await controller.track({
				type: "addToCart",
				sessionId: "s0",
			});
			await controller.track({
				type: "addToCart",
				sessionId: "s1",
			});
			await controller.track({
				type: "purchase",
				sessionId: "s0",
				value: 1000,
			});

			const funnel = await controller.getConversionFunnel();
			const pvStep = funnel.find((s) => s.step === "pageView");
			const cartStep = funnel.find((s) => s.step === "addToCart");
			const purchaseStep = funnel.find((s) => s.step === "purchase");
			expect(pvStep?.rate).toBe(100);
			expect(cartStep?.rate).toBe(50); // 2 of 4
			expect(purchaseStep?.rate).toBe(25); // 1 of 4
		});

		it("handles sessions that drop off at different stages", async () => {
			await controller.track({ type: "pageView", sessionId: "a" });

			await controller.track({ type: "pageView", sessionId: "b" });
			await controller.track({
				type: "productView",
				sessionId: "b",
			});

			await controller.track({ type: "pageView", sessionId: "c" });
			await controller.track({
				type: "productView",
				sessionId: "c",
			});
			await controller.track({ type: "addToCart", sessionId: "c" });

			const funnel = await controller.getConversionFunnel();
			const stepMap = new Map(funnel.map((s) => [s.step, s.count]));
			expect(stepMap.get("pageView")).toBe(3);
			expect(stepMap.get("productView")).toBe(2);
			expect(stepMap.get("addToCart")).toBe(1);
			expect(stepMap.get("checkout")).toBe(0);
			expect(stepMap.get("purchase")).toBe(0);
		});

		it("uses customerId as fallback session key when no sessionId", async () => {
			await controller.track({
				type: "pageView",
				customerId: "cust_x",
			});
			await controller.track({
				type: "productView",
				customerId: "cust_x",
			});
			await controller.track({
				type: "addToCart",
				customerId: "cust_x",
			});

			const funnel = await controller.getConversionFunnel();
			const stepMap = new Map(funnel.map((s) => [s.step, s.count]));
			// All events grouped under cust_x
			expect(stepMap.get("pageView")).toBe(1);
			expect(stepMap.get("addToCart")).toBe(1);
		});

		it("uses event id as fallback when no sessionId or customerId", async () => {
			await controller.track({ type: "pageView" });
			await controller.track({ type: "pageView" });

			const funnel = await controller.getConversionFunnel();
			const stepMap = new Map(funnel.map((s) => [s.step, s.count]));
			// Each event becomes its own session
			expect(stepMap.get("pageView")).toBe(2);
		});
	});

	// ── Date range filtering ─────────────────────────────────────────

	describe("date range filtering", () => {
		it("stats respect since boundary", async () => {
			await controller.track({ type: "pageView" });

			const future = new Date(Date.now() + 86400000);
			const stats = await controller.getStats({ since: future });
			expect(stats).toHaveLength(0);
		});

		it("stats respect until boundary", async () => {
			await controller.track({ type: "pageView" });

			const past = new Date(Date.now() - 86400000);
			const stats = await controller.getStats({ until: past });
			expect(stats).toHaveLength(0);
		});

		it("revenue summary respects date range", async () => {
			await controller.track({ type: "purchase", value: 5000 });

			const future = new Date(Date.now() + 86400000);
			const summary = await controller.getRevenueSummary({
				since: future,
			});
			expect(summary.totalRevenue).toBe(0);
			expect(summary.orderCount).toBe(0);
		});

		it("funnel respects date range", async () => {
			await controller.track({
				type: "pageView",
				sessionId: "s1",
			});
			await controller.track({
				type: "purchase",
				sessionId: "s1",
				value: 1000,
			});

			const future = new Date(Date.now() + 86400000);
			const funnel = await controller.getConversionFunnel({
				since: future,
			});
			for (const step of funnel) {
				expect(step.count).toBe(0);
			}
		});

		it("events within a tight range are included", async () => {
			await controller.track({ type: "pageView" });

			const justBefore = new Date(Date.now() - 1000);
			const justAfter = new Date(Date.now() + 1000);
			const events = await controller.listEvents({
				since: justBefore,
				until: justAfter,
			});
			expect(events).toHaveLength(1);
		});
	});

	// ── Event listing and pagination ─────────────────────────────────

	describe("event listing and pagination", () => {
		it("returns all events when no filters applied", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.track({ type: "pageView" });
			}
			const events = await controller.listEvents();
			expect(events).toHaveLength(5);
		});

		it("paginates with take and skip", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.track({ type: "pageView", sessionId: `s${i}` });
			}
			const page1 = await controller.listEvents({ take: 3, skip: 0 });
			const page2 = await controller.listEvents({ take: 3, skip: 3 });
			expect(page1).toHaveLength(3);
			expect(page2).toHaveLength(3);
			// Pages should not overlap
			const ids1 = page1.map((e) => e.id);
			const ids2 = page2.map((e) => e.id);
			for (const id of ids1) {
				expect(ids2).not.toContain(id);
			}
		});

		it("filters by multiple criteria simultaneously", async () => {
			await controller.track({
				type: "productView",
				sessionId: "s1",
				productId: "p1",
			});
			await controller.track({
				type: "productView",
				sessionId: "s2",
				productId: "p1",
			});
			await controller.track({
				type: "purchase",
				sessionId: "s1",
				productId: "p1",
				value: 1000,
			});

			const events = await controller.listEvents({
				type: "productView",
				productId: "p1",
				sessionId: "s1",
			});
			expect(events).toHaveLength(1);
			expect(events[0]?.sessionId).toBe("s1");
		});

		it("returns empty array when no events match filter", async () => {
			await controller.track({ type: "pageView" });
			const events = await controller.listEvents({
				type: "purchase",
			});
			expect(events).toEqual([]);
		});
	});

	// ── Recently viewed product workflows ────────────────────────────

	describe("recently viewed product workflows", () => {
		it("returns recently viewed products with metadata", async () => {
			await controller.track({
				type: "productView",
				sessionId: "s1",
				productId: "prod_1",
				data: {
					name: "Blue T-Shirt",
					slug: "blue-t-shirt",
					price: 2999,
					image: "/images/blue-tshirt.jpg",
				},
			});

			const items = await controller.getRecentlyViewed({
				sessionId: "s1",
			});
			expect(items).toHaveLength(1);
			expect(items[0]?.productId).toBe("prod_1");
			expect(items[0]?.name).toBe("Blue T-Shirt");
			expect(items[0]?.slug).toBe("blue-t-shirt");
			expect(items[0]?.price).toBe(2999);
			expect(items[0]?.image).toBe("/images/blue-tshirt.jpg");
			expect(items[0]?.viewedAt).toBeInstanceOf(Date);
		});

		it("deduplicates products keeping most recent view", async () => {
			await controller.track({
				type: "productView",
				sessionId: "s1",
				productId: "prod_1",
				data: { name: "Old Name", slug: "prod-1", price: 1000 },
			});
			await controller.track({
				type: "productView",
				sessionId: "s1",
				productId: "prod_2",
				data: { name: "Other Product", slug: "prod-2", price: 2000 },
			});
			await controller.track({
				type: "productView",
				sessionId: "s1",
				productId: "prod_1",
				data: { name: "New Name", slug: "prod-1", price: 1500 },
			});

			const items = await controller.getRecentlyViewed({
				sessionId: "s1",
			});
			expect(items).toHaveLength(2);
			// Most recent first: prod_1 (re-viewed), then prod_2
			expect(items[0]?.productId).toBe("prod_1");
			expect(items[0]?.name).toBe("New Name");
			expect(items[0]?.price).toBe(1500);
			expect(items[1]?.productId).toBe("prod_2");
		});

		it("excludes specified product from results", async () => {
			await controller.track({
				type: "productView",
				sessionId: "s1",
				productId: "prod_1",
				data: { name: "Product 1", slug: "p1", price: 100 },
			});
			await controller.track({
				type: "productView",
				sessionId: "s1",
				productId: "prod_2",
				data: { name: "Product 2", slug: "p2", price: 200 },
			});

			const items = await controller.getRecentlyViewed({
				sessionId: "s1",
				excludeProductId: "prod_1",
			});
			expect(items).toHaveLength(1);
			expect(items[0]?.productId).toBe("prod_2");
		});

		it("respects limit parameter", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.track({
					type: "productView",
					sessionId: "s1",
					productId: `prod_${i}`,
					data: { name: `Product ${i}`, slug: `p${i}`, price: i * 100 },
				});
			}

			const items = await controller.getRecentlyViewed({
				sessionId: "s1",
				limit: 3,
			});
			expect(items).toHaveLength(3);
		});

		it("filters by customerId when no sessionId provided", async () => {
			await controller.track({
				type: "productView",
				customerId: "cust_1",
				productId: "prod_a",
				data: { name: "Product A", slug: "pa", price: 100 },
			});
			await controller.track({
				type: "productView",
				customerId: "cust_2",
				productId: "prod_b",
				data: { name: "Product B", slug: "pb", price: 200 },
			});

			const items = await controller.getRecentlyViewed({
				customerId: "cust_1",
			});
			expect(items).toHaveLength(1);
			expect(items[0]?.productId).toBe("prod_a");
		});
	});
});
