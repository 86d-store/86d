import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { TrustBadge } from "../service";
import { createSocialProofController } from "../service-impl";

/**
 * Store endpoint integration tests for the social-proof module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. get-product-activity: returns activity counts for a product
 * 2. get-recent-activity: returns recent purchase/view events (public)
 * 3. get-trending: returns trending products based on activity
 * 4. list-badges: returns active trust badges by position
 * 5. record-event: tracks a customer activity event
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateGetProductActivity(
	data: DataService,
	productId: string,
) {
	const controller = createSocialProofController(data);
	const activity = await controller.getProductActivity(productId);
	return { activity };
}

async function simulateGetRecentActivity(
	data: DataService,
	query: { take?: number } = {},
) {
	const controller = createSocialProofController(data);
	const events = await controller.getRecentActivity({
		eventType: "purchase",
		take: query.take ?? 10,
	});
	return { events };
}

async function simulateGetTrending(
	data: DataService,
	query: { take?: number } = {},
) {
	const controller = createSocialProofController(data);
	const products = await controller.getTrendingProducts({
		take: query.take ?? 10,
	});
	return { products };
}

async function simulateListBadges(
	data: DataService,
	query: { position?: string } = {},
) {
	const controller = createSocialProofController(data);
	const badges = await controller.listBadges({
		isActive: true,
		...(query.position && {
			position: query.position as TrustBadge["position"],
		}),
	});
	return { badges };
}

async function simulateRecordEvent(
	data: DataService,
	body: {
		productId: string;
		productName: string;
		productSlug: string;
		eventType: "purchase" | "view" | "cart_add" | "wishlist_add";
		region?: string;
		city?: string;
		country?: string;
	},
) {
	const controller = createSocialProofController(data);
	const event = await controller.recordEvent(body);
	return { event };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: get product activity", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns activity counts for a product", async () => {
		const ctrl = createSocialProofController(data);
		await ctrl.recordEvent({
			productId: "prod_1",
			productName: "Widget",
			productSlug: "widget",
			eventType: "view",
		});
		await ctrl.recordEvent({
			productId: "prod_1",
			productName: "Widget",
			productSlug: "widget",
			eventType: "purchase",
		});

		const result = await simulateGetProductActivity(data, "prod_1");

		expect(result.activity.productId).toBe("prod_1");
		expect(result.activity.viewCount).toBeGreaterThanOrEqual(1);
		expect(result.activity.purchaseCount).toBeGreaterThanOrEqual(1);
	});

	it("returns zeros for product with no activity", async () => {
		const result = await simulateGetProductActivity(data, "prod_empty");

		expect(result.activity.viewCount).toBe(0);
		expect(result.activity.purchaseCount).toBe(0);
		expect(result.activity.totalEvents).toBe(0);
	});
});

describe("store endpoint: get recent activity", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns recent purchase events", async () => {
		const ctrl = createSocialProofController(data);
		await ctrl.recordEvent({
			productId: "prod_1",
			productName: "Widget",
			productSlug: "widget",
			eventType: "purchase",
			city: "New York",
			country: "US",
		});

		const result = await simulateGetRecentActivity(data);

		expect(result.events.length).toBeGreaterThanOrEqual(1);
		expect(result.events[0].eventType).toBe("purchase");
	});

	it("returns empty when no recent purchases", async () => {
		const result = await simulateGetRecentActivity(data);

		expect(result.events).toHaveLength(0);
	});

	it("respects take limit", async () => {
		const ctrl = createSocialProofController(data);
		for (let i = 0; i < 5; i++) {
			await ctrl.recordEvent({
				productId: `prod_${i}`,
				productName: `Product ${i}`,
				productSlug: `product-${i}`,
				eventType: "purchase",
			});
		}

		const result = await simulateGetRecentActivity(data, { take: 2 });

		expect(result.events).toHaveLength(2);
	});
});

describe("store endpoint: get trending products", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns trending products by event count", async () => {
		const ctrl = createSocialProofController(data);
		for (let i = 0; i < 5; i++) {
			await ctrl.recordEvent({
				productId: "prod_hot",
				productName: "Hot Widget",
				productSlug: "hot-widget",
				eventType: "purchase",
			});
		}
		await ctrl.recordEvent({
			productId: "prod_mild",
			productName: "Mild Widget",
			productSlug: "mild-widget",
			eventType: "view",
		});

		const result = await simulateGetTrending(data);

		expect(result.products.length).toBeGreaterThanOrEqual(1);
	});

	it("returns empty when no activity exists", async () => {
		const result = await simulateGetTrending(data);

		expect(result.products).toHaveLength(0);
	});
});

describe("store endpoint: list trust badges — active only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active badges", async () => {
		const ctrl = createSocialProofController(data);
		await ctrl.createBadge({
			name: "Secure Checkout",
			icon: "lock",
			position: "checkout",
			isActive: true,
		});
		await ctrl.createBadge({
			name: "Hidden Badge",
			icon: "hidden",
			position: "footer",
			isActive: false,
		});

		const result = await simulateListBadges(data);

		expect(result.badges).toHaveLength(1);
		expect((result.badges[0] as TrustBadge).name).toBe("Secure Checkout");
	});

	it("filters badges by position", async () => {
		const ctrl = createSocialProofController(data);
		await ctrl.createBadge({
			name: "Header Badge",
			icon: "shield",
			position: "header",
		});
		await ctrl.createBadge({
			name: "Footer Badge",
			icon: "check",
			position: "footer",
		});

		const result = await simulateListBadges(data, { position: "header" });

		expect(result.badges).toHaveLength(1);
		expect((result.badges[0] as TrustBadge).name).toBe("Header Badge");
	});

	it("returns empty when no active badges exist", async () => {
		const ctrl = createSocialProofController(data);
		await ctrl.createBadge({
			name: "Inactive",
			icon: "x",
			position: "header",
			isActive: false,
		});

		const result = await simulateListBadges(data);

		expect(result.badges).toHaveLength(0);
	});
});

describe("store endpoint: record event — activity tracking", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("records a purchase event", async () => {
		const result = await simulateRecordEvent(data, {
			productId: "prod_1",
			productName: "Widget",
			productSlug: "widget",
			eventType: "purchase",
			city: "Chicago",
			country: "US",
		});

		expect(result.event.productId).toBe("prod_1");
		expect(result.event.eventType).toBe("purchase");
		expect(result.event.city).toBe("Chicago");
	});

	it("records a view event", async () => {
		const result = await simulateRecordEvent(data, {
			productId: "prod_1",
			productName: "Widget",
			productSlug: "widget",
			eventType: "view",
		});

		expect(result.event.eventType).toBe("view");
	});

	it("records a cart add event", async () => {
		const result = await simulateRecordEvent(data, {
			productId: "prod_1",
			productName: "Widget",
			productSlug: "widget",
			eventType: "cart_add",
		});

		expect(result.event.eventType).toBe("cart_add");
	});
});
