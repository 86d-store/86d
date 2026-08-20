import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createRecentlyViewedController } from "../service-impl";

/**
 * Store endpoint integration tests for the recently-viewed module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. track-view: records a product view for customer or session
 * 2. get-recent: returns recently viewed products
 * 3. clear-history: clears viewing history
 * 4. merge-history: merges session views into customer account
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateTrackView(
	data: DataService,
	body: {
		productId: string;
		productName: string;
		productSlug: string;
		sessionId?: string;
	},
	opts: { customerId?: string } = {},
) {
	const controller = createRecentlyViewedController(data);
	const view = await controller.trackView({
		productId: body.productId,
		productName: body.productName,
		productSlug: body.productSlug,
		...(opts.customerId != null && { customerId: opts.customerId }),
		...(body.sessionId != null && { sessionId: body.sessionId }),
	});
	return { view };
}

async function simulateGetRecent(
	data: DataService,
	query: { take?: number } = {},
	opts: { customerId?: string; sessionId?: string } = {},
) {
	const controller = createRecentlyViewedController(data);
	const views = await controller.getRecentViews({
		...(opts.customerId != null && { customerId: opts.customerId }),
		...(opts.sessionId != null && { sessionId: opts.sessionId }),
		...(query.take != null && { take: query.take }),
	});
	return { views };
}

async function simulateClearHistory(
	data: DataService,
	opts: { customerId?: string; sessionId?: string } = {},
) {
	const controller = createRecentlyViewedController(data);
	const count = await controller.clearHistory({
		...(opts.customerId != null && { customerId: opts.customerId }),
		...(opts.sessionId != null && { sessionId: opts.sessionId }),
	});
	return { count };
}

async function simulateMergeHistory(
	data: DataService,
	body: { sessionId: string },
	opts: { customerId?: string } = {},
) {
	if (!opts.customerId) {
		return { error: "Authentication required", status: 401 };
	}
	const controller = createRecentlyViewedController(data);
	const count = await controller.mergeHistory({
		sessionId: body.sessionId,
		customerId: opts.customerId,
	});
	return { count };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: track view — record product view", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("tracks a view for authenticated customer", async () => {
		const result = await simulateTrackView(
			data,
			{ productId: "prod_1", productName: "Widget", productSlug: "widget" },
			{ customerId: "cust_1" },
		);

		expect("view" in result).toBe(true);
		if ("view" in result) {
			expect(result.view.productId).toBe("prod_1");
		}
	});

	it("tracks a view for anonymous session", async () => {
		const result = await simulateTrackView(data, {
			productId: "prod_2",
			productName: "Gadget",
			productSlug: "gadget",
			sessionId: "sess_abc",
		});

		expect("view" in result).toBe(true);
		if ("view" in result) {
			expect(result.view.productId).toBe("prod_2");
		}
	});
});

describe("store endpoint: get recent — recently viewed products", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns recently viewed products for customer", async () => {
		const ctrl = createRecentlyViewedController(data);
		await ctrl.trackView({
			productId: "prod_1",
			productName: "Widget",
			productSlug: "widget",
			customerId: "cust_1",
		});
		await ctrl.trackView({
			productId: "prod_2",
			productName: "Gadget",
			productSlug: "gadget",
			customerId: "cust_1",
		});

		const result = await simulateGetRecent(data, {}, { customerId: "cust_1" });

		expect("views" in result).toBe(true);
		if ("views" in result) {
			expect(result.views).toHaveLength(2);
		}
	});

	it("returns recently viewed for session", async () => {
		const ctrl = createRecentlyViewedController(data);
		await ctrl.trackView({
			productId: "prod_a",
			productName: "Alpha",
			productSlug: "alpha",
			sessionId: "sess_1",
		});

		const result = await simulateGetRecent(data, {}, { sessionId: "sess_1" });

		expect("views" in result).toBe(true);
		if ("views" in result) {
			expect(result.views).toHaveLength(1);
		}
	});

	it("supports pagination with take", async () => {
		const ctrl = createRecentlyViewedController(data);
		for (let i = 0; i < 10; i++) {
			await ctrl.trackView({
				productId: `prod_${i}`,
				productName: `Product ${i}`,
				productSlug: `product-${i}`,
				customerId: "cust_1",
			});
		}

		const result = await simulateGetRecent(
			data,
			{ take: 3 },
			{ customerId: "cust_1" },
		);

		expect("views" in result).toBe(true);
		if ("views" in result) {
			expect(result.views).toHaveLength(3);
		}
	});

	it("returns empty for new customer", async () => {
		const result = await simulateGetRecent(
			data,
			{},
			{ customerId: "cust_new" },
		);

		expect("views" in result).toBe(true);
		if ("views" in result) {
			expect(result.views).toHaveLength(0);
		}
	});
});

describe("store endpoint: clear history", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("clears customer's viewing history", async () => {
		const ctrl = createRecentlyViewedController(data);
		await ctrl.trackView({
			productId: "prod_1",
			productName: "Widget",
			productSlug: "widget",
			customerId: "cust_1",
		});
		await ctrl.trackView({
			productId: "prod_2",
			productName: "Gadget",
			productSlug: "gadget",
			customerId: "cust_1",
		});

		const result = await simulateClearHistory(data, {
			customerId: "cust_1",
		});

		expect(result.count).toBe(2);

		const after = await simulateGetRecent(data, {}, { customerId: "cust_1" });
		if ("views" in after) {
			expect(after.views).toHaveLength(0);
		}
	});
});

describe("store endpoint: merge history — session to customer", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateMergeHistory(data, {
			sessionId: "sess_1",
		});
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("merges session views into customer account", async () => {
		const ctrl = createRecentlyViewedController(data);
		await ctrl.trackView({
			productId: "prod_1",
			productName: "Widget",
			productSlug: "widget",
			sessionId: "sess_1",
		});
		await ctrl.trackView({
			productId: "prod_2",
			productName: "Gadget",
			productSlug: "gadget",
			sessionId: "sess_1",
		});

		const result = await simulateMergeHistory(
			data,
			{ sessionId: "sess_1" },
			{ customerId: "cust_1" },
		);

		expect("count" in result).toBe(true);
		if ("count" in result) {
			expect(result.count).toBe(2);
		}
	});
});
