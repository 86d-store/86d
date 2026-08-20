import { describe, expect, it, vi } from "vitest";
import { customerViews } from "../admin/endpoints/customer-views";
import { deleteView } from "../admin/endpoints/delete-view";
import { listAllViews } from "../admin/endpoints/list-views";
import { popularProducts } from "../admin/endpoints/popular-products";
import type {
	PopularProduct,
	ProductView,
	RecentlyViewedController,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeView(overrides: Partial<ProductView> = {}): ProductView {
	return {
		id: crypto.randomUUID(),
		productId: "prod-1",
		productName: "Widget",
		productSlug: "widget",
		viewedAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<RecentlyViewedController> = {},
): RecentlyViewedController {
	return {
		trackView: vi.fn().mockResolvedValue(makeView()),
		getRecentViews: vi.fn().mockResolvedValue([]),
		getPopularProducts: vi.fn().mockResolvedValue([]),
		clearHistory: vi.fn().mockResolvedValue(0),
		deleteView: vi.fn().mockResolvedValue(false),
		listAll: vi.fn().mockResolvedValue([]),
		countViews: vi.fn().mockResolvedValue(0),
		mergeHistory: vi.fn().mockResolvedValue(0),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: RecentlyViewedController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { recentlyViewed: opts.controller ?? makeController() },
		},
	});
}

const listHandler = extractHandler(listAllViews);
const customerHandler = extractHandler(customerViews);
const deleteHandler = extractHandler(deleteView);
const popularHandler = extractHandler(popularProducts);

describe("admin GET /recently-viewed", () => {
	it("returns empty list and zero total", async () => {
		const result = (await call(listHandler)) as {
			views: ProductView[];
			total: number;
		};
		expect(result.views).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards customerId filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { customerId: "cust-1" },
			controller: ctrl,
		});
		expect(ctrl.listAll).toHaveBeenCalledWith(
			expect.objectContaining({ customerId: "cust-1" }),
		);
	});
});

describe("admin GET /recently-viewed/customer/:id", () => {
	it("returns views and total for customer", async () => {
		const view = makeView({ customerId: "cust-1" });
		const ctrl = makeController({
			getRecentViews: vi.fn().mockResolvedValue([view]),
			countViews: vi.fn().mockResolvedValue(1),
		});
		const result = (await call(customerHandler, {
			params: { id: "cust-1" },
			controller: ctrl,
		})) as { views: ProductView[]; total: number };
		expect(result.views).toHaveLength(1);
		expect(result.total).toBe(1);
	});

	it("calls countViews with customerId param", async () => {
		const ctrl = makeController();
		await call(customerHandler, {
			params: { id: "cust-42" },
			controller: ctrl,
		});
		expect(ctrl.countViews).toHaveBeenCalledWith(
			expect.objectContaining({ customerId: "cust-42" }),
		);
	});
});

describe("admin DELETE /recently-viewed/:id/delete", () => {
	it("returns 404 when view not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBeTruthy();
	});

	it("returns success when view is deleted", async () => {
		const ctrl = makeController({
			deleteView: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "v1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

describe("admin GET /recently-viewed/popular", () => {
	it("returns empty products list", async () => {
		const result = (await call(popularHandler)) as {
			products: PopularProduct[];
		};
		expect(result.products).toHaveLength(0);
	});

	it("forwards take query to controller", async () => {
		const ctrl = makeController();
		await call(popularHandler, { query: { take: "5" }, controller: ctrl });
		expect(ctrl.getPopularProducts).toHaveBeenCalledWith(
			expect.objectContaining({ take: 5 }),
		);
	});
});
