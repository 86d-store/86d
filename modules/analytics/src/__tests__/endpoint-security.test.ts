import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAnalyticsController } from "../service-impl";

/**
 * Security regression tests for analytics endpoints.
 *
 * Analytics events contain behavioural data tied to sessions, customers,
 * and products. These tests verify:
 * - Event tracking isolation: one session/customer cannot read another's data
 * - Date range validation: future/inverted ranges return empty, not errors
 * - Metric aggregation integrity: revenue and stats are not inflated by
 *   unrelated event types or missing values
 * - Session scoping: funnel and recently-viewed honour session boundaries
 * - Visitor ID isolation: customerId and sessionId filters are strict
 */

describe("analytics endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAnalyticsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAnalyticsController(mockData);
	});

	// ── Event Tracking Isolation ─────────────────────────────────────

	describe("event tracking isolation", () => {
		it("listEvents by sessionId never returns another session's events", async () => {
			await controller.track({
				type: "pageView",
				sessionId: "victim_sess",
			});
			await controller.track({
				type: "pageView",
				sessionId: "victim_sess",
			});
			await controller.track({
				type: "pageView",
				sessionId: "attacker_sess",
			});

			const attackerEvents = await controller.listEvents({
				sessionId: "attacker_sess",
			});
			expect(attackerEvents).toHaveLength(1);
			for (const event of attackerEvents) {
				expect(event.sessionId).toBe("attacker_sess");
			}
		});

		it("listEvents by customerId never returns another customer's events", async () => {
			await controller.track({
				type: "purchase",
				customerId: "cust_victim",
				value: 9999,
			});
			await controller.track({
				type: "pageView",
				customerId: "cust_attacker",
			});

			const attackerEvents = await controller.listEvents({
				customerId: "cust_attacker",
			});
			expect(attackerEvents).toHaveLength(1);
			expect(attackerEvents[0].customerId).toBe("cust_attacker");
			expect(attackerEvents[0].type).toBe("pageView");
		});

		it("listEvents by productId does not leak events from other products", async () => {
			await controller.track({
				type: "productView",
				productId: "secret_prod",
				data: { name: "Secret" },
			});
			await controller.track({
				type: "productView",
				productId: "public_prod",
				data: { name: "Public" },
			});

			const result = await controller.listEvents({
				productId: "public_prod",
			});
			expect(result).toHaveLength(1);
			expect(result[0].productId).toBe("public_prod");
		});

		it("track does not bleed optional fields across events", async () => {
			const first = await controller.track({
				type: "purchase",
				sessionId: "s1",
				customerId: "c1",
				orderId: "o1",
				value: 5000,
			});
			const second = await controller.track({ type: "pageView" });

			expect(first.sessionId).toBe("s1");
			expect(second.sessionId).toBeUndefined();
			expect(second.customerId).toBeUndefined();
			expect(second.orderId).toBeUndefined();
			expect(second.value).toBeUndefined();
		});
	});

	// ── Date Range Validation ────────────────────────────────────────

	describe("date range validation", () => {
		it("future since date returns empty results for listEvents", async () => {
			await controller.track({ type: "pageView" });
			const events = await controller.listEvents({
				since: new Date("2099-01-01"),
			});
			expect(events).toHaveLength(0);
		});

		it("future since date returns empty results for getStats", async () => {
			await controller.track({ type: "pageView" });
			const stats = await controller.getStats({
				since: new Date("2099-01-01"),
			});
			expect(stats).toHaveLength(0);
		});

		it("until in the past excludes current events", async () => {
			await controller.track({ type: "purchase", value: 1000 });
			const summary = await controller.getRevenueSummary({
				until: new Date("2000-01-01"),
			});
			expect(summary.totalRevenue).toBe(0);
			expect(summary.orderCount).toBe(0);
		});

		it("inverted date range (since > until) returns empty", async () => {
			await controller.track({ type: "pageView" });
			const events = await controller.listEvents({
				since: new Date("2030-01-01"),
				until: new Date("2020-01-01"),
			});
			expect(events).toHaveLength(0);
		});
	});

	// ── Metric Aggregation Integrity ─────────────────────────────────

	describe("metric aggregation integrity", () => {
		it("revenue summary ignores non-purchase event types", async () => {
			await controller.track({ type: "pageView", value: 50000 });
			await controller.track({ type: "addToCart", value: 30000 });
			await controller.track({
				type: "purchase",
				value: 2500,
				productId: "p1",
			});

			const summary = await controller.getRevenueSummary();
			expect(summary.totalRevenue).toBe(2500);
			expect(summary.orderCount).toBe(1);
		});

		it("revenue summary treats missing value as zero", async () => {
			await controller.track({ type: "purchase", productId: "p1" });
			const summary = await controller.getRevenueSummary();
			expect(summary.totalRevenue).toBe(0);
			expect(summary.orderCount).toBe(1);
			expect(summary.averageOrderValue).toBe(0);
		});

		it("getTopProducts does not count non-view/purchase types", async () => {
			await controller.track({
				type: "addToCart",
				productId: "prod_1",
			});
			await controller.track({
				type: "checkout",
				productId: "prod_1",
			});
			await controller.track({
				type: "productView",
				productId: "prod_1",
			});

			const top = await controller.getTopProducts();
			expect(top).toHaveLength(1);
			expect(top[0]?.views).toBe(1);
			expect(top[0]?.purchases).toBe(0);
		});

		it("getSalesByProduct excludes non-purchase events entirely", async () => {
			await controller.track({
				type: "productView",
				productId: "p1",
				value: 10000,
			});
			await controller.track({
				type: "addToCart",
				productId: "p1",
				value: 10000,
			});
			await controller.track({
				type: "purchase",
				productId: "p1",
				value: 3000,
			});

			const sales = await controller.getSalesByProduct();
			expect(sales).toHaveLength(1);
			expect(sales[0]?.revenue).toBe(3000);
			expect(sales[0]?.orders).toBe(1);
		});

		it("revenue time series only counts purchase events", async () => {
			await controller.track({ type: "pageView", value: 99999 });
			await controller.track({
				type: "purchase",
				value: 1500,
				productId: "p1",
			});

			const series = await controller.getRevenueTimeSeries();
			expect(series).toHaveLength(1);
			expect(series[0]?.revenue).toBe(1500);
			expect(series[0]?.orders).toBe(1);
		});
	});

	// ── Session Scoping ──────────────────────────────────────────────

	describe("session scoping", () => {
		it("conversion funnel counts sessions independently", async () => {
			// Session A: full funnel
			for (const type of [
				"pageView",
				"productView",
				"addToCart",
				"checkout",
				"purchase",
			] as const) {
				await controller.track({
					type,
					sessionId: "sessA",
					...(type === "productView" || type === "addToCart"
						? { productId: "p1" }
						: {}),
					...(type === "purchase" ? { value: 5000 } : {}),
				});
			}

			// Session B: only pageView
			await controller.track({
				type: "pageView",
				sessionId: "sessB",
			});

			const funnel = await controller.getConversionFunnel();
			const purchaseStep = funnel.find((s) => s.step === "purchase");
			expect(purchaseStep?.count).toBe(1);

			const pageViewStep = funnel.find((s) => s.step === "pageView");
			expect(pageViewStep?.count).toBe(2);
		});

		it("funnel uses customerId as session key when sessionId is absent", async () => {
			await controller.track({
				type: "pageView",
				customerId: "cust_X",
			});
			await controller.track({
				type: "productView",
				customerId: "cust_X",
				productId: "p1",
			});
			await controller.track({
				type: "pageView",
				customerId: "cust_Y",
			});

			const funnel = await controller.getConversionFunnel();
			const pvStep = funnel.find((s) => s.step === "productView");
			expect(pvStep?.count).toBe(1);

			const pageStep = funnel.find((s) => s.step === "pageView");
			expect(pageStep?.count).toBe(2);
		});

		it("funnel falls back to event.id when no session or customer", async () => {
			await controller.track({ type: "pageView" });
			await controller.track({ type: "pageView" });

			const funnel = await controller.getConversionFunnel();
			const pageStep = funnel.find((s) => s.step === "pageView");
			// Each event gets its own id as session key, so count = 2
			expect(pageStep?.count).toBe(2);
		});
	});

	// ── Visitor ID Isolation ─────────────────────────────────────────

	describe("visitor ID isolation", () => {
		it("getRecentlyViewed for session A excludes session B products", async () => {
			await controller.track({
				type: "productView",
				sessionId: "sessA",
				productId: "prod_secret",
				data: { name: "Secret", slug: "secret", price: 999 },
			});
			await controller.track({
				type: "productView",
				sessionId: "sessB",
				productId: "prod_public",
				data: { name: "Public", slug: "public", price: 500 },
			});

			const itemsA = await controller.getRecentlyViewed({
				sessionId: "sessA",
			});
			expect(itemsA).toHaveLength(1);
			expect(itemsA[0]?.productId).toBe("prod_secret");

			const itemsB = await controller.getRecentlyViewed({
				sessionId: "sessB",
			});
			expect(itemsB).toHaveLength(1);
			expect(itemsB[0]?.productId).toBe("prod_public");
		});

		it("getRecentlyViewed for customer A excludes customer B products", async () => {
			await controller.track({
				type: "productView",
				customerId: "custA",
				productId: "prod_a",
				data: { name: "A Item", slug: "a-item", price: 100 },
			});
			await controller.track({
				type: "productView",
				customerId: "custB",
				productId: "prod_b",
				data: { name: "B Item", slug: "b-item", price: 200 },
			});

			const items = await controller.getRecentlyViewed({
				customerId: "custA",
			});
			expect(items).toHaveLength(1);
			expect(items[0]?.productId).toBe("prod_a");
		});

		it("search analytics does not leak queries across date boundaries", async () => {
			await controller.track({
				type: "search",
				data: { query: "secret item", resultCount: 3 },
			});

			const analytics = await controller.getSearchAnalytics({
				since: new Date("2099-01-01"),
			});
			expect(analytics.totalSearches).toBe(0);
			expect(analytics.topQueries).toHaveLength(0);
		});

		it("search analytics normalises queries to prevent duplicate enumeration", async () => {
			await controller.track({
				type: "search",
				data: { query: "  Credit Card  ", resultCount: 0 },
			});
			await controller.track({
				type: "search",
				data: { query: "credit card", resultCount: 0 },
			});
			await controller.track({
				type: "search",
				data: { query: "CREDIT CARD", resultCount: 0 },
			});

			const analytics = await controller.getSearchAnalytics();
			expect(analytics.uniqueQueries).toBe(1);
			expect(analytics.topQueries[0]?.query).toBe("credit card");
			expect(analytics.topQueries[0]?.count).toBe(3);
		});

		it("search analytics ignores events with non-string query data", async () => {
			await controller.track({
				type: "search",
				data: { query: 12345, resultCount: 1 },
			});
			await controller.track({
				type: "search",
				data: { query: null, resultCount: 0 },
			});
			await controller.track({
				type: "search",
				data: { query: "valid", resultCount: 5 },
			});

			const analytics = await controller.getSearchAnalytics();
			// Only the valid string query should be counted
			expect(analytics.uniqueQueries).toBe(1);
			expect(analytics.topQueries).toHaveLength(1);
			expect(analytics.topQueries[0]?.query).toBe("valid");
		});
	});

	// ── Edge Cases & Data Integrity ──────────────────────────────────

	describe("data integrity edge cases", () => {
		it("getRevenueSummary previous period is zero when no since provided", async () => {
			await controller.track({
				type: "purchase",
				value: 5000,
				productId: "p1",
			});

			const summary = await controller.getRevenueSummary();
			expect(summary.previousRevenue).toBe(0);
			expect(summary.previousOrders).toBe(0);
		});

		it("getTopProducts limit=0 returns empty", async () => {
			await controller.track({
				type: "productView",
				productId: "p1",
			});
			const top = await controller.getTopProducts({ limit: 0 });
			expect(top).toHaveLength(0);
		});

		it("getSalesByProduct averageValue is zero when value is missing", async () => {
			await controller.track({
				type: "purchase",
				productId: "p1",
			});
			const sales = await controller.getSalesByProduct();
			expect(sales).toHaveLength(1);
			expect(sales[0]?.revenue).toBe(0);
			expect(sales[0]?.averageValue).toBe(0);
		});

		it("getRecentlyViewed excludeProductId filters correctly", async () => {
			await controller.track({
				type: "productView",
				sessionId: "s1",
				productId: "current",
				data: { name: "Current", slug: "current", price: 100 },
			});
			await controller.track({
				type: "productView",
				sessionId: "s1",
				productId: "other",
				data: { name: "Other", slug: "other", price: 200 },
			});

			const items = await controller.getRecentlyViewed({
				sessionId: "s1",
				excludeProductId: "current",
			});
			expect(items).toHaveLength(1);
			expect(items[0]?.productId).toBe("other");
		});
	});
});
