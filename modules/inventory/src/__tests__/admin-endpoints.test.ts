import { describe, expect, it, vi } from "vitest";
import { adjustStock } from "../admin/endpoints/adjust-stock";
import { backInStockDelete } from "../admin/endpoints/back-in-stock-delete";
import { backInStockList } from "../admin/endpoints/back-in-stock-list";
import { backInStockStats } from "../admin/endpoints/back-in-stock-stats";
import { listItems } from "../admin/endpoints/list-items";
import { lowStock } from "../admin/endpoints/low-stock";
import { setStock } from "../admin/endpoints/set-stock";
import type {
	BackInStockStats,
	BackInStockSubscription,
	InventoryController,
	InventoryItem,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		productId: "prod-1",
		quantity: 100,
		reserved: 0,
		available: 100,
		allowBackorder: false,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeSubscription(
	overrides: Partial<BackInStockSubscription> = {},
): BackInStockSubscription {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		productId: "prod-1",
		email: "shopper@example.com",
		status: "active",
		subscribedAt: now,
		...overrides,
	};
}

function makeStats(
	overrides: Partial<BackInStockStats> = {},
): BackInStockStats {
	return {
		totalActive: 0,
		totalNotified: 0,
		uniqueProducts: 0,
		...overrides,
	};
}

function makeController(
	overrides: Partial<InventoryController> = {},
): InventoryController {
	return {
		getStock: vi.fn().mockResolvedValue(null),
		setStock: vi.fn().mockResolvedValue(makeItem()),
		adjustStock: vi.fn().mockResolvedValue(null),
		reserve: vi.fn().mockResolvedValue(false),
		release: vi.fn().mockResolvedValue(false),
		deduct: vi.fn().mockResolvedValue(false),
		isInStock: vi.fn().mockResolvedValue(false),
		getLowStockItems: vi.fn().mockResolvedValue([]),
		listItems: vi.fn().mockResolvedValue([]),
		subscribeBackInStock: vi.fn().mockResolvedValue(makeSubscription()),
		unsubscribeBackInStock: vi.fn().mockResolvedValue(false),
		checkBackInStockSubscription: vi.fn().mockResolvedValue(null),
		getBackInStockSubscribers: vi.fn().mockResolvedValue([]),
		listBackInStockSubscriptions: vi.fn().mockResolvedValue([]),
		getBackInStockStats: vi.fn().mockResolvedValue(makeStats()),
		markSubscribersNotified: vi.fn().mockResolvedValue(0),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: InventoryController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { inventory: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listItemsHandler = extractHandler(listItems);
const setStockHandler = extractHandler(setStock);
const adjustStockHandler = extractHandler(adjustStock);
const lowStockHandler = extractHandler(lowStock);
const backInStockListHandler = extractHandler(backInStockList);
const backInStockStatsHandler = extractHandler(backInStockStats);
const backInStockDeleteHandler = extractHandler(backInStockDelete);

// ── admin GET /inventory ──────────────────────────────────────────────────────

describe("admin GET /inventory", () => {
	it("returns empty list when no inventory items exist", async () => {
		const result = (await call(listItemsHandler)) as {
			items: InventoryItem[];
		};
		expect(result.items).toHaveLength(0);
	});

	it("forwards productId filter to controller", async () => {
		const ctrl = makeController();
		await call(listItemsHandler, {
			query: { productId: "prod-99" },
			controller: ctrl,
		});
		expect(ctrl.listItems).toHaveBeenCalledWith(
			expect.objectContaining({ productId: "prod-99" }),
		);
	});
});

// ── admin POST /inventory/set ─────────────────────────────────────────────────

describe("admin POST /inventory/set", () => {
	it("is contained until its Inventory Command is registered", async () => {
		const result = (await call(setStockHandler, {
			body: { productId: "prod-2", quantity: 50 },
		})) as { code: string; error: string; status: number };
		expect(result.status).toBe(503);
		expect(result.code).toBe("INVENTORY_SET_COMMAND_UNAVAILABLE");
	});

	it("never reaches the controller while contained", async () => {
		const ctrl = makeController();
		await call(setStockHandler, {
			body: {
				productId: "prod-3",
				quantity: 20,
				lowStockThreshold: 5,
				allowBackorder: true,
			},
			controller: ctrl,
		});
		expect(ctrl.setStock).not.toHaveBeenCalled();
	});
});

// ── admin POST /inventory/adjust ──────────────────────────────────────────────

describe("admin POST /inventory/adjust", () => {
	it("rejects a body without an idempotency key", async () => {
		await expect(
			call(adjustStockHandler, {
				body: { productId: "prod-4", delta: 5 },
			}),
		).rejects.toThrow(/idempotencyKey/);
	});

	it("requires the authenticated Store Command transport", async () => {
		const result = (await call(adjustStockHandler, {
			body: {
				productId: "prod-4",
				delta: 5,
				idempotencyKey: "3f1a6c2e-9b4d-4c7a-8e5f-1d2b3c4a5e6f",
			},
		})) as { code: string; error: string; status: number };
		expect(result.status).toBe(503);
		expect(result.code).toBe("INVENTORY_COMMAND_TRANSPORT_REQUIRED");
	});

	it("never reaches the controller while contained", async () => {
		const ctrl = makeController({
			adjustStock: vi.fn().mockResolvedValue(makeItem({ quantity: 105 })),
		});
		await call(adjustStockHandler, {
			body: {
				productId: "prod-4",
				delta: 5,
				idempotencyKey: "7c8d9e0f-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
			},
			controller: ctrl,
		});
		expect(ctrl.adjustStock).not.toHaveBeenCalled();
	});
});

// ── admin GET /inventory/low-stock ────────────────────────────────────────────

describe("admin GET /inventory/low-stock", () => {
	it("returns empty list when no low-stock items", async () => {
		const result = (await call(lowStockHandler)) as {
			items: InventoryItem[];
		};
		expect(result.items).toHaveLength(0);
	});

	it("returns low-stock items from controller", async () => {
		const items = [makeItem({ quantity: 2, lowStockThreshold: 5 })];
		const ctrl = makeController({
			getLowStockItems: vi.fn().mockResolvedValue(items),
		});
		const result = (await call(lowStockHandler, { controller: ctrl })) as {
			items: InventoryItem[];
		};
		expect(result.items).toHaveLength(1);
	});
});

// ── admin GET /inventory/back-in-stock ────────────────────────────────────────

describe("admin GET /inventory/back-in-stock", () => {
	it("returns empty subscriptions list", async () => {
		const result = (await call(backInStockListHandler)) as {
			subscriptions: BackInStockSubscription[];
		};
		expect(result.subscriptions).toHaveLength(0);
	});

	it("forwards productId filter to controller", async () => {
		const ctrl = makeController();
		await call(backInStockListHandler, {
			query: { productId: "prod-10" },
			controller: ctrl,
		});
		expect(ctrl.listBackInStockSubscriptions).toHaveBeenCalledWith(
			expect.objectContaining({ productId: "prod-10" }),
		);
	});
});

// ── admin GET /inventory/back-in-stock/stats ──────────────────────────────────

describe("admin GET /inventory/back-in-stock/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(backInStockStatsHandler)) as {
			stats: BackInStockStats;
		};
		expect(result.stats.totalActive).toBe(0);
		expect(result.stats.uniqueProducts).toBe(0);
	});

	it("returns real stats from controller", async () => {
		const ctrl = makeController({
			getBackInStockStats: vi
				.fn()
				.mockResolvedValue(
					makeStats({ totalActive: 42, totalNotified: 15, uniqueProducts: 8 }),
				),
		});
		const result = (await call(backInStockStatsHandler, {
			controller: ctrl,
		})) as { stats: BackInStockStats };
		expect(result.stats.totalActive).toBe(42);
		expect(result.stats.uniqueProducts).toBe(8);
	});
});

// ── admin DELETE /inventory/back-in-stock/:id ─────────────────────────────────

describe("admin DELETE /inventory/back-in-stock/:id", () => {
	it("returns removed=false for malformed id", async () => {
		const result = (await call(backInStockDeleteHandler, {
			params: { id: "bad" },
		})) as { removed: boolean };
		expect(result.removed).toBe(false);
	});

	it("calls unsubscribeBackInStock with parsed parts and returns removed", async () => {
		const ctrl = makeController({
			unsubscribeBackInStock: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(backInStockDeleteHandler, {
			params: { id: "prod-1:_:shopper@example.com" },
			controller: ctrl,
		})) as { removed: boolean };
		expect(result.removed).toBe(true);
		expect(ctrl.unsubscribeBackInStock).toHaveBeenCalledWith({
			productId: "prod-1",
			variantId: undefined,
			email: "shopper@example.com",
		});
	});
});
