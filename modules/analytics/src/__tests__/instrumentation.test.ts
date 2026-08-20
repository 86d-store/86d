import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { AnalyticsController } from "../service";
import { createAnalyticsController } from "../service-impl";

/**
 * Tests for analytics instrumentation event contracts.
 *
 * These tests verify the event types, payload shapes, and data flow
 * that the storefront instrumentation layer relies on. Each test group
 * mirrors a specific instrumentation point in the store.
 */
describe("Analytics Instrumentation Events", () => {
	let controller: AnalyticsController;

	beforeEach(() => {
		controller = createAnalyticsController(createMockDataService());
	});

	// ── pageView ─────────────────────────────────────────────────────────────

	describe("pageView events", () => {
		it("records a pageView with path data", async () => {
			const event = await controller.track({
				type: "pageView",
				data: { path: "/products", url: "/products?category=shoes" },
			});

			expect(event.type).toBe("pageView");
			expect(event.data.path).toBe("/products");
			expect(event.data.url).toBe("/products?category=shoes");
		});

		it("records multiple pageViews for navigation tracking", async () => {
			await controller.track({
				type: "pageView",
				data: { path: "/" },
			});
			await controller.track({
				type: "pageView",
				data: { path: "/products" },
			});
			await controller.track({
				type: "pageView",
				data: { path: "/products/blue-sneakers" },
			});

			const stats = await controller.getStats();
			const pageViews = stats.find((s) => s.type === "pageView");
			expect(pageViews?.count).toBe(3);
		});
	});

	// ── productView ──────────────────────────────────────────────────────────

	describe("productView events", () => {
		it("records a productView with product metadata", async () => {
			const event = await controller.track({
				type: "productView",
				productId: "prod-123",
				data: { name: "Blue Sneakers", slug: "blue-sneakers", price: 9999 },
			});

			expect(event.type).toBe("productView");
			expect(event.productId).toBe("prod-123");
			expect(event.data.name).toBe("Blue Sneakers");
			expect(event.data.slug).toBe("blue-sneakers");
			expect(event.data.price).toBe(9999);
		});

		it("counts toward top products views", async () => {
			await controller.track({
				type: "productView",
				productId: "prod-123",
			});
			await controller.track({
				type: "productView",
				productId: "prod-123",
			});
			await controller.track({
				type: "productView",
				productId: "prod-456",
			});

			const top = await controller.getTopProducts();
			const prod123 = top.find((p) => p.productId === "prod-123");
			const prod456 = top.find((p) => p.productId === "prod-456");

			expect(prod123?.views).toBe(2);
			expect(prod456?.views).toBe(1);
		});
	});

	// ── addToCart ─────────────────────────────────────────────────────────────

	describe("addToCart events", () => {
		it("records addToCart with product and value", async () => {
			const event = await controller.track({
				type: "addToCart",
				productId: "prod-abc",
				value: 4999,
				data: { name: "Classic Tee", quantity: 2 },
			});

			expect(event.type).toBe("addToCart");
			expect(event.productId).toBe("prod-abc");
			expect(event.value).toBe(4999);
			expect(event.data.name).toBe("Classic Tee");
			expect(event.data.quantity).toBe(2);
		});

		it("records addToCart with variant info", async () => {
			const event = await controller.track({
				type: "addToCart",
				productId: "prod-abc",
				value: 5999,
				data: {
					name: "Classic Tee",
					quantity: 1,
					variantId: "var-lg-blue",
				},
			});

			expect(event.data.variantId).toBe("var-lg-blue");
		});
	});

	// ── removeFromCart ────────────────────────────────────────────────────────

	describe("removeFromCart events", () => {
		it("records removeFromCart with product info", async () => {
			const event = await controller.track({
				type: "removeFromCart",
				productId: "prod-xyz",
				value: 2999,
				data: { name: "Wool Socks", quantity: 1 },
			});

			expect(event.type).toBe("removeFromCart");
			expect(event.productId).toBe("prod-xyz");
			expect(event.value).toBe(2999);
			expect(event.data.name).toBe("Wool Socks");
		});
	});

	// ── checkout ──────────────────────────────────────────────────────────────

	describe("checkout events", () => {
		it("records checkout with session and cart value", async () => {
			const event = await controller.track({
				type: "checkout",
				value: 15998,
				data: { sessionId: "sess-abc", itemCount: 3 },
			});

			expect(event.type).toBe("checkout");
			expect(event.value).toBe(15998);
			expect(event.data.sessionId).toBe("sess-abc");
			expect(event.data.itemCount).toBe(3);
		});
	});

	// ── purchase ─────────────────────────────────────────────────────────────

	describe("purchase events", () => {
		it("records purchase with orderId", async () => {
			const event = await controller.track({
				type: "purchase",
				orderId: "ORD-ABC123",
				data: { source: "checkout" },
			});

			expect(event.type).toBe("purchase");
			expect(event.orderId).toBe("ORD-ABC123");
			expect(event.data.source).toBe("checkout");
		});

		it("counts toward top products purchases", async () => {
			await controller.track({
				type: "purchase",
				productId: "prod-abc",
				orderId: "ORD-1",
			});
			await controller.track({
				type: "purchase",
				productId: "prod-abc",
				orderId: "ORD-2",
			});

			const top = await controller.getTopProducts();
			const prod = top.find((p) => p.productId === "prod-abc");
			expect(prod?.purchases).toBe(2);
		});
	});

	// ── search ───────────────────────────────────────────────────────────────

	describe("search events", () => {
		it("records search with query and result count", async () => {
			const event = await controller.track({
				type: "search",
				data: { query: "blue sneakers", resultCount: 12 },
			});

			expect(event.type).toBe("search");
			expect(event.data.query).toBe("blue sneakers");
			expect(event.data.resultCount).toBe(12);
		});

		it("records zero-result searches", async () => {
			const event = await controller.track({
				type: "search",
				data: { query: "nonexistent product xyz", resultCount: 0 },
			});

			expect(event.data.resultCount).toBe(0);
		});
	});

	// ── full funnel ──────────────────────────────────────────────────────────

	describe("full conversion funnel", () => {
		it("tracks a complete user journey through stats", async () => {
			// 1. User visits homepage
			await controller.track({
				type: "pageView",
				data: { path: "/" },
			});

			// 2. User searches for products
			await controller.track({
				type: "search",
				data: { query: "sneakers", resultCount: 5 },
			});

			// 3. User views a product
			await controller.track({
				type: "productView",
				productId: "prod-1",
			});

			// 4. User adds to cart
			await controller.track({
				type: "addToCart",
				productId: "prod-1",
				value: 9999,
			});

			// 5. User begins checkout
			await controller.track({
				type: "checkout",
				value: 9999,
			});

			// 6. User completes purchase
			await controller.track({
				type: "purchase",
				orderId: "ORD-1",
				productId: "prod-1",
				value: 9999,
			});

			// Verify full funnel in stats
			const stats = await controller.getStats();
			const types = new Map(stats.map((s) => [s.type, s.count]));

			expect(types.get("pageView")).toBe(1);
			expect(types.get("search")).toBe(1);
			expect(types.get("productView")).toBe(1);
			expect(types.get("addToCart")).toBe(1);
			expect(types.get("checkout")).toBe(1);
			expect(types.get("purchase")).toBe(1);

			// Verify in top products
			const top = await controller.getTopProducts();
			expect(top[0].productId).toBe("prod-1");
			expect(top[0].views).toBe(1);
			expect(top[0].purchases).toBe(1);
		});

		it("calculates conversion rates from stats", async () => {
			// Simulate a store with realistic funnel drop-off
			for (let i = 0; i < 100; i++) {
				await controller.track({ type: "pageView" });
			}
			for (let i = 0; i < 40; i++) {
				await controller.track({
					type: "productView",
					productId: `prod-${i % 5}`,
				});
			}
			for (let i = 0; i < 15; i++) {
				await controller.track({
					type: "addToCart",
					productId: `prod-${i % 5}`,
				});
			}
			for (let i = 0; i < 8; i++) {
				await controller.track({ type: "checkout" });
			}
			for (let i = 0; i < 5; i++) {
				await controller.track({
					type: "purchase",
					productId: `prod-${i % 5}`,
					orderId: `ORD-${i}`,
				});
			}

			const stats = await controller.getStats();
			const types = new Map(stats.map((s) => [s.type, s.count]));

			// pageView → productView conversion: 40/100 = 40%
			const browseRate =
				(types.get("productView") ?? 0) / (types.get("pageView") ?? 1);
			expect(browseRate).toBeCloseTo(0.4);

			// addToCart → purchase conversion: 5/15 = 33%
			const cartConversion =
				(types.get("purchase") ?? 0) / (types.get("addToCart") ?? 1);
			expect(cartConversion).toBeCloseTo(0.333, 2);
		});
	});
});
