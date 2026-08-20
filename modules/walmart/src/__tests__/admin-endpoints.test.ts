import { describe, expect, it, vi } from "vitest";
import { acknowledgeOrderEndpoint } from "../admin/endpoints/acknowledge-order";
import { cancelOrderEndpoint } from "../admin/endpoints/cancel-order";
import { createItemEndpoint } from "../admin/endpoints/create-item";
import { getItemEndpoint } from "../admin/endpoints/get-item";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { itemHealthEndpoint } from "../admin/endpoints/item-health";
import { listFeedsEndpoint } from "../admin/endpoints/list-feeds";
import { listItemsEndpoint } from "../admin/endpoints/list-items";
import { listOrdersEndpoint } from "../admin/endpoints/list-orders";
import { retireItemEndpoint } from "../admin/endpoints/retire-item";
import { shipOrderEndpoint } from "../admin/endpoints/ship-order";
import { statsEndpoint } from "../admin/endpoints/stats";
import { submitFeedEndpoint } from "../admin/endpoints/submit-feed";
import { syncOrdersEndpoint } from "../admin/endpoints/sync-orders";
import { updateItemEndpoint } from "../admin/endpoints/update-item";
import type {
	ChannelStats,
	FeedSubmission,
	ItemHealth,
	WalmartController,
	WalmartItem,
	WalmartOrder,
} from "../service";

const mockVerifyConnection = vi.hoisted(() =>
	vi.fn().mockResolvedValue({ ok: true, mode: "sandbox" }),
);

vi.mock("../provider", () => ({
	WalmartProvider: class {
		verifyConnection = mockVerifyConnection;
	},
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeItem(overrides: Partial<WalmartItem> = {}): WalmartItem {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		localProductId: "prod_1",
		sku: "SKU-001",
		title: "Widget Pro",
		status: "published",
		lifecycleStatus: "active",
		price: 2999,
		quantity: 50,
		fulfillmentType: "seller",
		metadata: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeOrder(overrides: Partial<WalmartOrder> = {}): WalmartOrder {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		purchaseOrderId: "WM_ORDER_1",
		status: "created",
		items: [],
		orderTotal: 2999,
		shippingTotal: 0,
		walmartFee: 300,
		tax: 240,
		shippingAddress: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeFeedSubmission(
	overrides: Partial<FeedSubmission> = {},
): FeedSubmission {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		feedType: "item",
		status: "completed",
		totalItems: 10,
		successItems: 10,
		errorItems: 0,
		submittedAt: now,
		createdAt: now,
		...overrides,
	};
}

function makeItemHealth(overrides: Partial<ItemHealth> = {}): ItemHealth {
	return {
		total: 50,
		published: 45,
		unpublished: 3,
		retired: 1,
		systemError: 1,
		sellerFulfilled: 30,
		wfsFulfilled: 20,
		...overrides,
	};
}

function makeChannelStats(overrides: Partial<ChannelStats> = {}): ChannelStats {
	return {
		totalItems: 50,
		publishedItems: 45,
		totalOrders: 10,
		totalRevenue: 29990,
		pendingFeeds: 0,
		errorItems: 1,
		...overrides,
	};
}

function makeController(
	overrides: Partial<WalmartController> = {},
): WalmartController {
	return {
		createItem: vi.fn().mockResolvedValue(makeItem()),
		updateItem: vi.fn().mockResolvedValue(null),
		retireItem: vi.fn().mockResolvedValue(null),
		getItem: vi.fn().mockResolvedValue(null),
		getItemByProduct: vi.fn().mockResolvedValue(null),
		listItems: vi.fn().mockResolvedValue([]),
		submitFeed: vi.fn().mockResolvedValue(makeFeedSubmission()),
		getLastFeed: vi.fn().mockResolvedValue(null),
		listFeeds: vi.fn().mockResolvedValue([]),
		receiveOrder: vi.fn().mockResolvedValue(makeOrder()),
		acknowledgeOrder: vi.fn().mockResolvedValue(null),
		shipOrder: vi.fn().mockResolvedValue(null),
		cancelOrder: vi.fn().mockResolvedValue(null),
		listOrders: vi.fn().mockResolvedValue([]),
		getChannelStats: vi.fn().mockResolvedValue(makeChannelStats()),
		getItemHealth: vi.fn().mockResolvedValue(makeItemHealth()),
		syncOrders: vi.fn().mockResolvedValue([]),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: WalmartController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { walmart: opts.controller ?? makeController() } },
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const settingsHandler = extractHandler(
	createGetSettingsEndpoint({
		clientId: "CLIENT_ID_1",
		clientSecret: "CLIENT_SECRET_1",
		sandbox: true,
	}),
);
const settingsEmptyHandler = extractHandler(createGetSettingsEndpoint({}));
const createItemHandler = extractHandler(createItemEndpoint);
const updateItemHandler = extractHandler(updateItemEndpoint);
const retireItemHandler = extractHandler(retireItemEndpoint);
const getItemHandler = extractHandler(getItemEndpoint);
const listItemsHandler = extractHandler(listItemsEndpoint);
const submitFeedHandler = extractHandler(submitFeedEndpoint);
const listFeedsHandler = extractHandler(listFeedsEndpoint);
const acknowledgeOrderHandler = extractHandler(acknowledgeOrderEndpoint);
const shipOrderHandler = extractHandler(shipOrderEndpoint);
const cancelOrderHandler = extractHandler(cancelOrderEndpoint);
const listOrdersHandler = extractHandler(listOrdersEndpoint);
const syncOrdersHandler = extractHandler(syncOrdersEndpoint);
const statsHandler = extractHandler(statsEndpoint);
const itemHealthHandler = extractHandler(itemHealthEndpoint);

// ── GET /admin/walmart/settings ───────────────────────────────────────────────

describe("admin GET /walmart/settings", () => {
	it("returns not_configured when no credentials", async () => {
		const result = (await settingsEmptyHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { status: string; configured: boolean };
		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it("returns connected when credentials are valid", async () => {
		mockVerifyConnection.mockResolvedValueOnce({
			ok: true,
			mode: "sandbox",
		});
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { status: string; configured: boolean; mode: string };
		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
		expect(result.mode).toBe("sandbox");
	});

	it("returns error when verification fails", async () => {
		mockVerifyConnection.mockResolvedValueOnce({
			ok: false,
			error: "Invalid credentials",
		});
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { status: string; error: string };
		expect(result.status).toBe("error");
		expect(result.error).toBe("Invalid credentials");
	});
});

// ── POST /admin/walmart/items/create ─────────────────────────────────────────

describe("admin POST /walmart/items/create", () => {
	it("creates an item and returns it", async () => {
		const item = makeItem({ sku: "SKU-XYZ", title: "Deluxe Widget" });
		const ctrl = makeController({
			createItem: vi.fn().mockResolvedValue(item),
		});
		const result = (await call(createItemHandler, {
			body: {
				localProductId: "prod_1",
				sku: "SKU-XYZ",
				title: "Deluxe Widget",
				price: 4999,
			},
			controller: ctrl,
		})) as { item: WalmartItem };
		expect(result.item.sku).toBe("SKU-XYZ");
		expect(result.item.title).toBe("Deluxe Widget");
	});

	it("forwards fulfillmentType to controller", async () => {
		const ctrl = makeController();
		await call(createItemHandler, {
			body: {
				localProductId: "prod_2",
				sku: "SKU-WFS",
				title: "WFS Product",
				price: 3999,
				fulfillmentType: "wfs",
			},
			controller: ctrl,
		});
		expect(ctrl.createItem).toHaveBeenCalledWith(
			expect.objectContaining({ fulfillmentType: "wfs" }),
		);
	});
});

// ── PUT /admin/walmart/items/:id/update ──────────────────────────────────────

describe("admin PUT /walmart/items/:id/update", () => {
	it("updates item and returns it", async () => {
		const updated = makeItem({ id: "item_1", price: 3499 });
		const ctrl = makeController({
			updateItem: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateItemHandler, {
			params: { id: "item_1" },
			body: { price: 3499 },
			controller: ctrl,
		})) as { item: WalmartItem };
		expect(result.item.price).toBe(3499);
	});

	it("returns null item when not found", async () => {
		const result = (await call(updateItemHandler, {
			params: { id: "missing" },
			body: {},
		})) as { item: null };
		expect(result.item).toBeNull();
	});
});

// ── PUT /admin/walmart/items/:id/retire ──────────────────────────────────────

describe("admin PUT /walmart/items/:id/retire", () => {
	it("retires item and returns it", async () => {
		const item = makeItem({ id: "item_1", status: "retired" });
		const ctrl = makeController({
			retireItem: vi.fn().mockResolvedValue(item),
		});
		const result = (await call(retireItemHandler, {
			params: { id: "item_1" },
			controller: ctrl,
		})) as { item: WalmartItem };
		expect(result.item.status).toBe("retired");
		expect(ctrl.retireItem).toHaveBeenCalledWith("item_1");
	});
});

// ── GET /admin/walmart/items/:id ─────────────────────────────────────────────

describe("admin GET /walmart/items/:id", () => {
	it("returns null when not found", async () => {
		const result = (await call(getItemHandler, {
			params: { id: "missing" },
		})) as { item: null };
		expect(result.item).toBeNull();
	});

	it("returns item when found", async () => {
		const item = makeItem({ id: "item_1" });
		const ctrl = makeController({
			getItem: vi.fn().mockResolvedValue(item),
		});
		const result = (await call(getItemHandler, {
			params: { id: "item_1" },
			controller: ctrl,
		})) as { item: WalmartItem };
		expect(result.item.id).toBe("item_1");
	});
});

// ── GET /admin/walmart/items ──────────────────────────────────────────────────

describe("admin GET /walmart/items", () => {
	it("returns empty list when no items", async () => {
		const result = (await call(listItemsHandler)) as {
			items: WalmartItem[];
			total: number;
		};
		expect(result.items).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns items from controller", async () => {
		const items = [makeItem(), makeItem()];
		const ctrl = makeController({
			listItems: vi.fn().mockResolvedValue(items),
		});
		const result = (await call(listItemsHandler, {
			controller: ctrl,
		})) as { items: WalmartItem[]; total: number };
		expect(result.items).toHaveLength(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listItemsHandler, {
			query: { status: "published" },
			controller: ctrl,
		});
		expect(ctrl.listItems).toHaveBeenCalledWith(
			expect.objectContaining({ status: "published" }),
		);
	});
});

// ── POST /admin/walmart/feeds/submit ─────────────────────────────────────────

describe("admin POST /walmart/feeds/submit", () => {
	it("submits feed and returns submission record", async () => {
		const feed = makeFeedSubmission({ feedType: "inventory", totalItems: 20 });
		const ctrl = makeController({
			submitFeed: vi.fn().mockResolvedValue(feed),
		});
		const result = (await call(submitFeedHandler, {
			body: { feedType: "inventory" },
			controller: ctrl,
		})) as { feed: FeedSubmission };
		expect(result.feed.feedType).toBe("inventory");
		expect(result.feed.totalItems).toBe(20);
		expect(ctrl.submitFeed).toHaveBeenCalledWith("inventory");
	});
});

// ── GET /admin/walmart/feeds ──────────────────────────────────────────────────

describe("admin GET /walmart/feeds", () => {
	it("returns empty list when no feeds", async () => {
		const result = (await call(listFeedsHandler)) as {
			feeds: FeedSubmission[];
			total: number;
		};
		expect(result.feeds).toHaveLength(0);
	});

	it("returns feeds from controller", async () => {
		const feeds = [makeFeedSubmission(), makeFeedSubmission()];
		const ctrl = makeController({
			listFeeds: vi.fn().mockResolvedValue(feeds),
		});
		const result = (await call(listFeedsHandler, {
			controller: ctrl,
		})) as { feeds: FeedSubmission[]; total: number };
		expect(result.feeds).toHaveLength(2);
	});
});

// ── PUT /admin/walmart/orders/:id/acknowledge ────────────────────────────────

describe("admin PUT /walmart/orders/:id/acknowledge", () => {
	it("acknowledges order and returns it", async () => {
		const order = makeOrder({ id: "ord_1", status: "acknowledged" });
		const ctrl = makeController({
			acknowledgeOrder: vi.fn().mockResolvedValue(order),
		});
		const result = (await call(acknowledgeOrderHandler, {
			params: { id: "ord_1" },
			controller: ctrl,
		})) as { order: WalmartOrder };
		expect(result.order.status).toBe("acknowledged");
		expect(ctrl.acknowledgeOrder).toHaveBeenCalledWith("ord_1");
	});
});

// ── PUT /admin/walmart/orders/:id/ship ───────────────────────────────────────

describe("admin PUT /walmart/orders/:id/ship", () => {
	it("ships order and returns it", async () => {
		const order = makeOrder({ id: "ord_1", status: "shipped" });
		const ctrl = makeController({
			shipOrder: vi.fn().mockResolvedValue(order),
		});
		const result = (await call(shipOrderHandler, {
			params: { id: "ord_1" },
			body: { trackingNumber: "1Z999", carrier: "UPS" },
			controller: ctrl,
		})) as { order: WalmartOrder };
		expect(result.order.status).toBe("shipped");
		expect(ctrl.shipOrder).toHaveBeenCalledWith("ord_1", "1Z999", "UPS");
	});
});

// ── PUT /admin/walmart/orders/:id/cancel ─────────────────────────────────────

describe("admin PUT /walmart/orders/:id/cancel", () => {
	it("cancels order and returns it", async () => {
		const order = makeOrder({ id: "ord_1", status: "cancelled" });
		const ctrl = makeController({
			cancelOrder: vi.fn().mockResolvedValue(order),
		});
		const result = (await call(cancelOrderHandler, {
			params: { id: "ord_1" },
			controller: ctrl,
		})) as { order: WalmartOrder };
		expect(result.order.status).toBe("cancelled");
	});
});

// ── GET /admin/walmart/orders ─────────────────────────────────────────────────

describe("admin GET /walmart/orders", () => {
	it("returns empty list when no orders", async () => {
		const result = (await call(listOrdersHandler)) as {
			orders: WalmartOrder[];
			total: number;
		};
		expect(result.orders).toHaveLength(0);
	});

	it("returns orders from controller", async () => {
		const orders = [makeOrder(), makeOrder()];
		const ctrl = makeController({
			listOrders: vi.fn().mockResolvedValue(orders),
		});
		const result = (await call(listOrdersHandler, {
			controller: ctrl,
		})) as { orders: WalmartOrder[]; total: number };
		expect(result.orders).toHaveLength(2);
	});
});

// ── POST /admin/walmart/sync-orders ──────────────────────────────────────────

describe("admin POST /walmart/sync-orders", () => {
	it("syncs orders and returns count", async () => {
		const orders = [makeOrder(), makeOrder()];
		const ctrl = makeController({
			syncOrders: vi.fn().mockResolvedValue(orders),
		});
		const result = (await call(syncOrdersHandler, {
			controller: ctrl,
		})) as { synced: number };
		expect(result.synced).toBe(2);
	});
});

// ── GET /admin/walmart/stats ──────────────────────────────────────────────────

describe("admin GET /walmart/stats", () => {
	it("returns channel stats", async () => {
		const stats = makeChannelStats({ totalItems: 50, publishedItems: 45 });
		const ctrl = makeController({
			getChannelStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(statsHandler, {
			controller: ctrl,
		})) as { stats: ChannelStats };
		expect(result.stats.totalItems).toBe(50);
		expect(result.stats.publishedItems).toBe(45);
	});
});

// ── GET /admin/walmart/items/health ──────────────────────────────────────────

describe("admin GET /walmart/items/health", () => {
	it("returns item health metrics", async () => {
		const health = makeItemHealth({ total: 50, published: 45 });
		const ctrl = makeController({
			getItemHealth: vi.fn().mockResolvedValue(health),
		});
		const result = (await call(itemHealthHandler, {
			controller: ctrl,
		})) as { health: ItemHealth };
		expect(result.health.total).toBe(50);
		expect(result.health.published).toBe(45);
	});
});
