import { describe, expect, it, vi } from "vitest";
import { deleteWishlistItem } from "../admin/endpoints/delete-wishlist-item";
import { listAllWishlists } from "../admin/endpoints/list-all-wishlists";
import { wishlistSummary } from "../admin/endpoints/wishlist-summary";
import type {
	WishlistController,
	WishlistItem,
	WishlistSummary,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeItem(overrides: Partial<WishlistItem> = {}): WishlistItem {
	return {
		id: crypto.randomUUID(),
		customerId: "cust_1",
		productId: "prod_1",
		productName: "Test Product",
		addedAt: new Date(),
		...overrides,
	};
}

function makeSummary(
	overrides: Partial<WishlistSummary> = {},
): WishlistSummary {
	return {
		totalItems: 0,
		topProducts: [],
		...overrides,
	};
}

function makeController(
	overrides: Partial<WishlistController> = {},
): WishlistController {
	return {
		addItem: vi.fn().mockResolvedValue(makeItem()),
		removeItem: vi.fn().mockResolvedValue(false),
		removeByProduct: vi.fn().mockResolvedValue(false),
		bulkRemove: vi.fn().mockResolvedValue(0),
		getItem: vi.fn().mockResolvedValue(null),
		isInWishlist: vi.fn().mockResolvedValue(false),
		listByCustomer: vi.fn().mockResolvedValue([]),
		listAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
		countByCustomer: vi.fn().mockResolvedValue(0),
		getSummary: vi.fn().mockResolvedValue(makeSummary()),
		createShareToken: vi.fn().mockResolvedValue(null),
		revokeShareToken: vi.fn().mockResolvedValue(false),
		getShareTokens: vi.fn().mockResolvedValue([]),
		getSharedWishlist: vi.fn().mockResolvedValue(null),
		...overrides,
	} as WishlistController;
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: WishlistController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { wishlist: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listAllHandler = extractHandler(listAllWishlists);
const summaryHandler = extractHandler(wishlistSummary);
const deleteItemHandler = extractHandler(deleteWishlistItem);

// ── listAllWishlists ──────────────────────────────────────────────────────────

describe("admin GET /wishlist", () => {
	it("returns empty list when no wishlist items exist", async () => {
		const result = (await call(listAllHandler)) as {
			items: WishlistItem[];
			total: number;
		};
		expect(result.items).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("passes customerId and productId filters with default pagination", async () => {
		const items = [makeItem({ customerId: "cust_5", productId: "prod_7" })];
		const ctrl = makeController({
			listAll: vi.fn().mockResolvedValue({ items, total: 1 }),
		});
		const result = (await call(listAllHandler, {
			query: { customerId: "cust_5", productId: "prod_7" },
			controller: ctrl,
		})) as { items: WishlistItem[]; total: number };
		expect(result.items).toHaveLength(1);
		expect(result.total).toBe(1);
		expect(ctrl.listAll).toHaveBeenCalledWith(
			expect.objectContaining({
				customerId: "cust_5",
				productId: "prod_7",
				take: 50,
				skip: 0,
			}),
		);
	});
});

// ── wishlistSummary ───────────────────────────────────────────────────────────

describe("admin GET /wishlist/summary", () => {
	it("returns zero-state summary when no items", async () => {
		const result = (await call(summaryHandler)) as {
			summary: WishlistSummary;
		};
		expect(result.summary.totalItems).toBe(0);
		expect(result.summary.topProducts).toHaveLength(0);
	});

	it("returns summary with top products from controller", async () => {
		const summary = makeSummary({
			totalItems: 42,
			topProducts: [
				{ productId: "prod_1", productName: "Widget", count: 15 },
				{ productId: "prod_2", productName: "Gadget", count: 10 },
			],
		});
		const ctrl = makeController({
			getSummary: vi.fn().mockResolvedValue(summary),
		});
		const result = (await call(summaryHandler, { controller: ctrl })) as {
			summary: WishlistSummary;
		};
		expect(result.summary.totalItems).toBe(42);
		expect(result.summary.topProducts).toHaveLength(2);
		expect(result.summary.topProducts[0].productName).toBe("Widget");
	});
});

// ── deleteWishlistItem ────────────────────────────────────────────────────────

describe("admin DELETE /wishlist/:id/delete", () => {
	it("returns 404 when wishlist item not found", async () => {
		const result = (await call(deleteItemHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Wishlist item not found");
	});

	it("deletes existing item and returns deleted flag", async () => {
		const item = makeItem({ id: "wi_1" });
		const ctrl = makeController({
			getItem: vi.fn().mockResolvedValue(item),
			removeItem: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteItemHandler, {
			params: { id: "wi_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
		expect(ctrl.removeItem).toHaveBeenCalledWith("wi_1");
	});
});
