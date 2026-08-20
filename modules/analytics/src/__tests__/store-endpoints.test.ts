import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAnalyticsController } from "../service-impl";

/**
 * Store endpoint integration tests for the analytics module.
 *
 * These tests simulate the business logic executed by store-facing endpoints:
 *
 * 1. track-event: records an analytics event (public, no auth)
 * 2. recently-viewed: returns recently viewed products (public, no auth)
 * 3. get-client-config: returns GTM container config (public, no auth)
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ────────────────────────────────────────────

async function simulateTrackEvent(
	data: DataService,
	body: {
		type: string;
		sessionId?: string;
		productId?: string;
		orderId?: string;
		value?: number;
		data?: Record<string, unknown>;
	},
) {
	const controller = createAnalyticsController(data);
	const event = await controller.track({
		type: body.type,
		sessionId: body.sessionId,
		productId: body.productId,
		orderId: body.orderId,
		value: body.value,
		data: body.data ?? {},
	});
	return { event };
}

async function simulateRecentlyViewed(
	data: DataService,
	params: {
		sessionId?: string;
		customerId?: string;
		excludeProductId?: string;
		limit?: number;
	},
) {
	const controller = createAnalyticsController(data);
	const items = await controller.getRecentlyViewed(params);
	return { items };
}

function simulateClientConfig(gtmContainerId?: string) {
	return {
		gtm: {
			enabled: Boolean(gtmContainerId),
			containerId: gtmContainerId ?? null,
		},
	};
}

// ── Tests: track-event ─────────────────────────────────────────────────

describe("store endpoint: track-event", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("records a page view event", async () => {
		const result = await simulateTrackEvent(data, {
			type: "pageView",
			sessionId: "sess_abc",
		});

		expect("event" in result).toBe(true);
		if ("event" in result) {
			expect(result.event.type).toBe("pageView");
			expect(result.event.sessionId).toBe("sess_abc");
		}
	});

	it("records a product view event with product and value", async () => {
		const result = await simulateTrackEvent(data, {
			type: "productView",
			productId: "prod_123",
			value: 4999,
			data: { name: "Running Shoes", slug: "running-shoes" },
		});

		expect("event" in result).toBe(true);
		if ("event" in result) {
			expect(result.event.type).toBe("productView");
			expect(result.event.productId).toBe("prod_123");
			expect(result.event.value).toBe(4999);
		}
	});

	it("records a purchase event with order id", async () => {
		const result = await simulateTrackEvent(data, {
			type: "purchase",
			orderId: "ord_xyz",
			value: 12999,
		});

		expect("event" in result).toBe(true);
		if ("event" in result) {
			expect(result.event.type).toBe("purchase");
			expect(result.event.orderId).toBe("ord_xyz");
			expect(result.event.value).toBe(12999);
		}
	});

	it("records multiple events independently", async () => {
		await simulateTrackEvent(data, { type: "pageView", sessionId: "sess_1" });
		await simulateTrackEvent(data, { type: "addToCart", sessionId: "sess_1" });
		await simulateTrackEvent(data, { type: "checkout", sessionId: "sess_1" });

		const controller = createAnalyticsController(data);
		const events = await controller.listEvents({ sessionId: "sess_1" });
		expect(events.length).toBeGreaterThanOrEqual(3);
	});
});

// ── Tests: recently-viewed ─────────────────────────────────────────────

describe("store endpoint: recently-viewed", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns empty list when no products have been viewed", async () => {
		const result = await simulateRecentlyViewed(data, {
			sessionId: "sess_fresh",
		});
		expect(result.items).toHaveLength(0);
	});

	it("returns recently viewed products for a session", async () => {
		const ctrl = createAnalyticsController(data);
		await ctrl.track({
			type: "productView",
			sessionId: "sess_rv",
			productId: "prod_a",
			data: { name: "Product A", slug: "product-a", price: 999 },
		});
		await ctrl.track({
			type: "productView",
			sessionId: "sess_rv",
			productId: "prod_b",
			data: { name: "Product B", slug: "product-b", price: 1999 },
		});

		const result = await simulateRecentlyViewed(data, { sessionId: "sess_rv" });

		expect(result.items.length).toBeGreaterThanOrEqual(2);
		const ids = result.items.map((i) => i.productId);
		expect(ids).toContain("prod_a");
		expect(ids).toContain("prod_b");
	});

	it("excludes a specific product from results", async () => {
		const ctrl = createAnalyticsController(data);
		await ctrl.track({
			type: "productView",
			sessionId: "sess_exclude",
			productId: "prod_x",
			data: { name: "Product X", slug: "product-x", price: 499 },
		});
		await ctrl.track({
			type: "productView",
			sessionId: "sess_exclude",
			productId: "prod_y",
			data: { name: "Product Y", slug: "product-y", price: 799 },
		});

		const result = await simulateRecentlyViewed(data, {
			sessionId: "sess_exclude",
			excludeProductId: "prod_x",
		});

		const ids = result.items.map((i) => i.productId);
		expect(ids).not.toContain("prod_x");
		expect(ids).toContain("prod_y");
	});

	it("respects the limit parameter", async () => {
		const ctrl = createAnalyticsController(data);
		for (let i = 0; i < 5; i++) {
			await ctrl.track({
				type: "productView",
				sessionId: "sess_limit",
				productId: `prod_${i}`,
				data: { name: `Product ${i}`, slug: `product-${i}`, price: 100 * i },
			});
		}

		const result = await simulateRecentlyViewed(data, {
			sessionId: "sess_limit",
			limit: 3,
		});

		expect(result.items).toHaveLength(3);
	});
});

// ── Tests: get-client-config ───────────────────────────────────────────

describe("store endpoint: get-client-config", () => {
	it("returns GTM disabled when no container ID is configured", () => {
		const result = simulateClientConfig();

		expect(result.gtm.enabled).toBe(false);
		expect(result.gtm.containerId).toBeNull();
	});

	it("returns GTM enabled with the configured container ID", () => {
		const result = simulateClientConfig("GTM-ABC123");

		expect(result.gtm.enabled).toBe(true);
		expect(result.gtm.containerId).toBe("GTM-ABC123");
	});
});
