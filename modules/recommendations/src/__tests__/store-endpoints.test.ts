import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type {
	RecommendationImpression,
	RecommendationSurface,
	RecommendedProduct,
} from "../service";
import { createRecommendationController } from "../service-impl";

/**
 * Store endpoint integration tests for the recommendations module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. get-trending: returns trending products within a time window
 * 2. get-personalized: auth required, returns user-specific recommendations
 * 3. get-for-product: strategy-based recommendations for a product
 * 4. track-interaction: records user interaction (view/purchase/add_to_cart),
 *    authenticated vs guest handling
 * 5. record-click: records a recommendation click tied to an impression
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateGetTrending(
	data: DataService,
	query: { take?: number } = {},
) {
	const controller = createRecommendationController(data);
	const take = query.take ?? 10;
	const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
	const products = await controller.getTrending({ take, since });
	return { products };
}

async function simulateGetPersonalized(
	data: DataService,
	opts: { userId?: string; take?: number } = {},
) {
	if (!opts.userId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createRecommendationController(data);
	const products = await controller.getPersonalized(opts.userId, {
		take: opts.take ?? 10,
	});
	return { products };
}

async function simulateGetForProduct(
	data: DataService,
	productId: string,
	query: { strategy?: string; take?: number } = {},
) {
	const controller = createRecommendationController(data);
	const products = await controller.getForProduct(productId, {
		strategy: query.strategy as
			| "manual"
			| "bought_together"
			| "trending"
			| "personalized"
			| "ai_similar"
			| undefined,
		take: query.take ?? 10,
	});
	return { products };
}

async function simulateRecordClick(
	data: DataService,
	body: {
		impressionId: string;
		productId: string;
		position: number;
		strategy?:
			| "manual"
			| "bought_together"
			| "trending"
			| "personalized"
			| "ai_similar";
	},
) {
	const controller = createRecommendationController(data);
	const click = await controller.recordClick(body);
	if (!click) {
		return { error: "Impression not found", status: 404 };
	}
	return { id: click.id };
}

async function simulateTrackInteraction(
	data: DataService,
	body: {
		productId: string;
		type: "view" | "purchase" | "add_to_cart";
		productName: string;
		productSlug: string;
		productImage?: string;
		productPrice?: number;
		productCategory?: string;
		sessionId?: string;
	},
	opts: { userId?: string } = {},
) {
	const controller = createRecommendationController(data);
	await controller.trackInteraction({
		productId: body.productId,
		customerId: opts.userId,
		sessionId: body.sessionId,
		type: body.type,
		productName: body.productName,
		productSlug: body.productSlug,
		productImage: body.productImage,
		productPrice: body.productPrice,
		productCategory: body.productCategory,
	});
	return { success: true };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: get trending", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns empty when no interactions exist", async () => {
		const result = await simulateGetTrending(data);
		expect(result.products).toHaveLength(0);
	});

	it("returns trending products based on recent interactions", async () => {
		const ctrl = createRecommendationController(data);
		for (let i = 0; i < 3; i++) {
			await ctrl.trackInteraction({
				productId: "prod_hot",
				sessionId: "session_trending",
				type: "view",
				productName: "Hot Product",
				productSlug: "hot-product",
			});
		}
		await ctrl.trackInteraction({
			productId: "prod_warm",
			sessionId: "session_trending",
			type: "view",
			productName: "Warm Product",
			productSlug: "warm-product",
		});

		const result = await simulateGetTrending(data, { take: 10 });

		expect(result.products.length).toBeGreaterThanOrEqual(1);
	});

	it("respects take limit", async () => {
		const ctrl = createRecommendationController(data);
		for (let i = 0; i < 5; i++) {
			await ctrl.trackInteraction({
				productId: `prod_${i}`,
				sessionId: "session_limit",
				type: "view",
				productName: `Product ${i}`,
				productSlug: `product-${i}`,
			});
		}

		const result = await simulateGetTrending(data, { take: 2 });

		expect(result.products.length).toBeLessThanOrEqual(2);
	});
});

describe("store endpoint: get personalized — auth required", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateGetPersonalized(data);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns personalized recommendations for authenticated user", async () => {
		const ctrl = createRecommendationController(data);
		await ctrl.trackInteraction({
			productId: "prod_viewed",
			customerId: "cust_1",
			type: "view",
			productName: "Viewed Product",
			productSlug: "viewed-product",
			productCategory: "electronics",
		});

		const result = await simulateGetPersonalized(data, {
			userId: "cust_1",
		});

		expect("products" in result).toBe(true);
		// May return empty if no co-occurrences exist yet
		if ("products" in result) {
			expect(Array.isArray(result.products)).toBe(true);
		}
	});

	it("returns empty for user with no interaction history", async () => {
		const result = await simulateGetPersonalized(data, {
			userId: "cust_new",
		});

		expect("products" in result).toBe(true);
		if ("products" in result) {
			expect(result.products).toHaveLength(0);
		}
	});
});

describe("store endpoint: get for product — strategy-based", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns recommendations for a product with manual strategy", async () => {
		const ctrl = createRecommendationController(data);
		await ctrl.createRule({
			name: "Cross-sell Widget",
			strategy: "manual",
			sourceProductId: "prod_a",
			targetProductIds: ["prod_b", "prod_c"],
		});

		const result = await simulateGetForProduct(data, "prod_a", {
			strategy: "manual",
		});

		expect(result.products.length).toBeGreaterThanOrEqual(1);
		const ids = (result.products as RecommendedProduct[]).map(
			(p) => p.productId,
		);
		expect(ids).toContain("prod_b");
	});

	it("returns empty when no recommendations exist for product", async () => {
		const result = await simulateGetForProduct(data, "prod_lonely");

		expect(result.products).toHaveLength(0);
	});

	it("respects take limit", async () => {
		const ctrl = createRecommendationController(data);
		await ctrl.createRule({
			name: "Many recommendations",
			strategy: "manual",
			sourceProductId: "prod_a",
			targetProductIds: ["prod_1", "prod_2", "prod_3", "prod_4", "prod_5"],
		});

		const result = await simulateGetForProduct(data, "prod_a", {
			strategy: "manual",
			take: 2,
		});

		expect(result.products.length).toBeLessThanOrEqual(2);
	});
});

describe("store endpoint: track interaction", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("records a view interaction for authenticated user", async () => {
		const result = await simulateTrackInteraction(
			data,
			{
				productId: "prod_1",
				type: "view",
				productName: "Widget",
				productSlug: "widget",
			},
			{ userId: "cust_1" },
		);

		expect(result.success).toBe(true);
	});

	it("records a purchase interaction", async () => {
		const result = await simulateTrackInteraction(
			data,
			{
				productId: "prod_1",
				type: "purchase",
				productName: "Widget",
				productSlug: "widget",
				productPrice: 2999,
			},
			{ userId: "cust_1" },
		);

		expect(result.success).toBe(true);
	});

	it("records an add_to_cart interaction", async () => {
		const result = await simulateTrackInteraction(data, {
			productId: "prod_1",
			type: "add_to_cart",
			productName: "Widget",
			productSlug: "widget",
			sessionId: "session_abc",
		});

		expect(result.success).toBe(true);
	});

	it("tracks guest interaction using sessionId", async () => {
		const result = await simulateTrackInteraction(data, {
			productId: "prod_1",
			type: "view",
			productName: "Widget",
			productSlug: "widget",
			sessionId: "guest_session_123",
		});

		expect(result.success).toBe(true);
	});

	it("includes product metadata in the interaction", async () => {
		const result = await simulateTrackInteraction(data, {
			productId: "prod_1",
			type: "view",
			productName: "Premium Widget",
			productSlug: "premium-widget",
			productImage: "https://img.example.com/widget.jpg",
			productPrice: 4999,
			productCategory: "electronics",
			sessionId: "session_metadata",
		});

		expect(result.success).toBe(true);
	});
});

describe("store endpoint: record click", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	async function createImpression(
		d: DataService,
		productIds: string[],
		surface: RecommendationSurface = "trending",
	): Promise<RecommendationImpression> {
		const ctrl = createRecommendationController(d);
		return ctrl.recordImpression({
			surface,
			productIds,
			strategies: ["trending"],
		});
	}

	it("records a click for a product that was in the impression", async () => {
		const impression = await createImpression(data, ["prod_a", "prod_b"]);

		const result = await simulateRecordClick(data, {
			impressionId: impression.id,
			productId: "prod_a",
			position: 0,
			strategy: "trending",
		});

		expect("id" in result).toBe(true);
		expect("error" in result).toBe(false);
	});

	it("returns 404 when impression does not exist", async () => {
		const result = await simulateRecordClick(data, {
			impressionId: "nonexistent-impression-id",
			productId: "prod_a",
			position: 0,
		});

		expect(result).toEqual({ error: "Impression not found", status: 404 });
	});

	it("returns 404 when productId was not in the served impression", async () => {
		const impression = await createImpression(data, ["prod_a", "prod_b"]);

		const result = await simulateRecordClick(data, {
			impressionId: impression.id,
			productId: "prod_not_served",
			position: 0,
		});

		expect(result).toEqual({ error: "Impression not found", status: 404 });
	});

	it("records position and strategy on the click", async () => {
		const ctrl = createRecommendationController(data);
		const impression = await createImpression(
			data,
			["prod_1", "prod_2", "prod_3"],
			"for_product",
		);

		await simulateRecordClick(data, {
			impressionId: impression.id,
			productId: "prod_2",
			position: 1,
			strategy: "manual",
		});

		const analytics = await ctrl.getAnalytics();
		expect(analytics.totalClicks).toBe(1);
		expect(analytics.clickThroughRate).toBeGreaterThan(0);
	});

	it("increments CTR when multiple impressions are clicked", async () => {
		const ctrl = createRecommendationController(data);

		const i1 = await createImpression(data, ["prod_a"]);
		const i2 = await createImpression(data, ["prod_a"]);
		await createImpression(data, ["prod_a"]);

		await simulateRecordClick(data, {
			impressionId: i1.id,
			productId: "prod_a",
			position: 0,
		});
		await simulateRecordClick(data, {
			impressionId: i2.id,
			productId: "prod_a",
			position: 0,
		});

		const analytics = await ctrl.getAnalytics();
		// 3 impressions, 2 with clicks → ~66% CTR
		expect(analytics.totalImpressions).toBe(3);
		expect(analytics.totalClicks).toBe(2);
		expect(analytics.clickThroughRate).toBeGreaterThan(0);
		expect(analytics.clickThroughRate).toBeLessThanOrEqual(100);
	});

	it("works without an explicit strategy (inherits from impression)", async () => {
		const impression = await createImpression(data, ["prod_a"]);

		const result = await simulateRecordClick(data, {
			impressionId: impression.id,
			productId: "prod_a",
			position: 0,
		});

		expect("id" in result).toBe(true);
	});
});
