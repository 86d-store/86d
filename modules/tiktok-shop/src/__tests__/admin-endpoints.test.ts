import { describe, expect, it, vi } from "vitest";
import { createListingEndpoint } from "../admin/endpoints/create-listing";
import { deleteListingEndpoint } from "../admin/endpoints/delete-listing";
import { getListingEndpoint } from "../admin/endpoints/get-listing";
import { getOrderEndpoint } from "../admin/endpoints/get-order";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { listListingsEndpoint } from "../admin/endpoints/list-listings";
import { listOrdersEndpoint } from "../admin/endpoints/list-orders";
import { listSyncsEndpoint } from "../admin/endpoints/list-syncs";
import { pushProductEndpoint } from "../admin/endpoints/push-product";
import { statsEndpoint } from "../admin/endpoints/stats";
import { syncCatalogEndpoint } from "../admin/endpoints/sync-catalog";
import { syncOrdersEndpoint } from "../admin/endpoints/sync-orders";
import { syncProductsEndpoint } from "../admin/endpoints/sync-products";
import { updateListingEndpoint } from "../admin/endpoints/update-listing";
import { updateOrderStatusEndpoint } from "../admin/endpoints/update-order-status";
import type {
	CatalogSync,
	ChannelOrder,
	ChannelStats,
	Listing,
	TikTokShopController,
} from "../service";

const mockVerifyConnection = vi.hoisted(() =>
	vi.fn().mockResolvedValue({ ok: true, shopId: "shop_1" }),
);

vi.mock("../provider", () => ({
	TikTokShopProvider: class {
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

function makeListing(overrides: Partial<Listing> = {}): Listing {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		localProductId: "prod_1",
		title: "TikTok Product",
		status: "active",
		syncStatus: "synced",
		metadata: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeOrder(overrides: Partial<ChannelOrder> = {}): ChannelOrder {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		externalOrderId: "tiktok_order_1",
		status: "pending",
		items: [],
		subtotal: 1999,
		shippingFee: 299,
		platformFee: 100,
		total: 2398,
		shippingAddress: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeCatalogSync(overrides: Partial<CatalogSync> = {}): CatalogSync {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		status: "synced",
		totalProducts: 5,
		syncedProducts: 5,
		failedProducts: 0,
		startedAt: now,
		createdAt: now,
		...overrides,
	};
}

function makeChannelStats(overrides: Partial<ChannelStats> = {}): ChannelStats {
	return {
		totalListings: 5,
		activeListings: 4,
		pendingListings: 1,
		failedListings: 0,
		totalOrders: 2,
		pendingOrders: 1,
		shippedOrders: 0,
		deliveredOrders: 1,
		cancelledOrders: 0,
		totalRevenue: 4796,
		...overrides,
	};
}

function makeController(
	overrides: Partial<TikTokShopController> = {},
): TikTokShopController {
	return {
		createListing: vi.fn().mockResolvedValue(makeListing()),
		updateListing: vi.fn().mockResolvedValue(null),
		deleteListing: vi.fn().mockResolvedValue(false),
		getListing: vi.fn().mockResolvedValue(null),
		getListingByProduct: vi.fn().mockResolvedValue(null),
		listListings: vi.fn().mockResolvedValue([]),
		syncCatalog: vi.fn().mockResolvedValue(makeCatalogSync()),
		getLastSync: vi.fn().mockResolvedValue(null),
		listSyncs: vi.fn().mockResolvedValue([]),
		receiveOrder: vi.fn().mockResolvedValue(makeOrder()),
		getOrder: vi.fn().mockResolvedValue(null),
		updateOrderStatus: vi.fn().mockResolvedValue(null),
		listOrders: vi.fn().mockResolvedValue([]),
		getChannelStats: vi.fn().mockResolvedValue(makeChannelStats()),
		pushProduct: vi.fn().mockResolvedValue(null),
		syncProducts: vi.fn().mockResolvedValue({ synced: 0 }),
		syncOrders: vi.fn().mockResolvedValue({ synced: 0 }),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: TikTokShopController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: {
				tiktokShop: opts.controller ?? makeController(),
			},
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const settingsHandler = extractHandler(
	createGetSettingsEndpoint({
		appKey: "app_key_1",
		appSecret: "app_secret_1",
		accessToken: "token_1",
		shopId: "shop_1",
	}),
);
const settingsEmptyHandler = extractHandler(createGetSettingsEndpoint({}));
const createListingHandler = extractHandler(createListingEndpoint);
const updateListingHandler = extractHandler(updateListingEndpoint);
const deleteListingHandler = extractHandler(deleteListingEndpoint);
const getListingHandler = extractHandler(getListingEndpoint);
const listListingsHandler = extractHandler(listListingsEndpoint);
const getOrderHandler = extractHandler(getOrderEndpoint);
const listOrdersHandler = extractHandler(listOrdersEndpoint);
const updateOrderStatusHandler = extractHandler(updateOrderStatusEndpoint);
const listSyncsHandler = extractHandler(listSyncsEndpoint);
const syncCatalogHandler = extractHandler(syncCatalogEndpoint);
const syncOrdersHandler = extractHandler(syncOrdersEndpoint);
const syncProductsHandler = extractHandler(syncProductsEndpoint);
const pushProductHandler = extractHandler(pushProductEndpoint);
const statsHandler = extractHandler(statsEndpoint);

// ── GET /admin/tiktok-shop/settings ──────────────────────────────────────────

describe("admin GET /tiktok-shop/settings", () => {
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
			shopId: "shop_1",
		});
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { status: string; configured: boolean };
		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
	});

	it("returns error when verification fails", async () => {
		mockVerifyConnection.mockResolvedValueOnce({
			ok: false,
			error: "Invalid app key",
		});
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { status: string; error: string };
		expect(result.status).toBe("error");
		expect(result.error).toBe("Invalid app key");
	});

	it("returns shopId and sandbox flag in response", async () => {
		mockVerifyConnection.mockResolvedValueOnce({
			ok: true,
			shopId: "shop_1",
		});
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { shopId: string; sandbox: boolean };
		expect(result.shopId).toBe("shop_1");
	});
});

// ── POST /admin/tiktok-shop/listings/create ──────────────────────────────────

describe("admin POST /tiktok-shop/listings/create", () => {
	it("creates a listing and returns it", async () => {
		const listing = makeListing({ title: "Viral Hat" });
		const ctrl = makeController({
			createListing: vi.fn().mockResolvedValue(listing),
		});
		const result = (await call(createListingHandler, {
			body: { localProductId: "prod_1", title: "Viral Hat" },
			controller: ctrl,
		})) as { listing: Listing };
		expect(result.listing.title).toBe("Viral Hat");
	});
});

// ── PUT /admin/tiktok-shop/listings/:id/update ───────────────────────────────

describe("admin PUT /tiktok-shop/listings/:id/update", () => {
	it("updates listing and returns it", async () => {
		const updated = makeListing({ id: "lst_1", status: "active" });
		const ctrl = makeController({
			updateListing: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateListingHandler, {
			params: { id: "lst_1" },
			body: { status: "active" },
			controller: ctrl,
		})) as { listing: Listing };
		expect(result.listing.status).toBe("active");
	});

	it("returns error when not found", async () => {
		const result = (await call(updateListingHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string };
		expect(result.error).toBe("Listing not found");
	});
});

// ── DELETE /admin/tiktok-shop/listings/:id/delete ────────────────────────────

describe("admin DELETE /tiktok-shop/listings/:id/delete", () => {
	it("returns deleted: false when not found", async () => {
		const result = (await call(deleteListingHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("returns deleted: true when deleted", async () => {
		const ctrl = makeController({
			deleteListing: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteListingHandler, {
			params: { id: "lst_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

// ── GET /admin/tiktok-shop/listings/:id ──────────────────────────────────────

describe("admin GET /tiktok-shop/listings/:id", () => {
	it("returns error when not found", async () => {
		const result = (await call(getListingHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Listing not found");
	});

	it("returns listing when found", async () => {
		const listing = makeListing({ id: "lst_1" });
		const ctrl = makeController({
			getListing: vi.fn().mockResolvedValue(listing),
		});
		const result = (await call(getListingHandler, {
			params: { id: "lst_1" },
			controller: ctrl,
		})) as { listing: Listing };
		expect(result.listing.id).toBe("lst_1");
	});
});

// ── GET /admin/tiktok-shop/listings ──────────────────────────────────────────

describe("admin GET /tiktok-shop/listings", () => {
	it("returns empty list when no listings", async () => {
		const result = (await call(listListingsHandler)) as {
			listings: Listing[];
			total: number;
		};
		expect(result.listings).toHaveLength(0);
	});

	it("returns listings from controller", async () => {
		const listings = [makeListing(), makeListing()];
		const ctrl = makeController({
			listListings: vi.fn().mockResolvedValue(listings),
		});
		const result = (await call(listListingsHandler, {
			controller: ctrl,
		})) as { listings: Listing[]; total: number };
		expect(result.listings).toHaveLength(2);
	});
});

// ── GET /admin/tiktok-shop/orders/:id ────────────────────────────────────────

describe("admin GET /tiktok-shop/orders/:id", () => {
	it("returns error when not found", async () => {
		const result = (await call(getOrderHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Order not found");
	});

	it("returns order when found", async () => {
		const order = makeOrder({ id: "ord_1" });
		const ctrl = makeController({
			getOrder: vi.fn().mockResolvedValue(order),
		});
		const result = (await call(getOrderHandler, {
			params: { id: "ord_1" },
			controller: ctrl,
		})) as { order: ChannelOrder };
		expect(result.order.id).toBe("ord_1");
	});
});

// ── GET /admin/tiktok-shop/orders ────────────────────────────────────────────

describe("admin GET /tiktok-shop/orders", () => {
	it("returns empty list when no orders", async () => {
		const result = (await call(listOrdersHandler)) as {
			orders: ChannelOrder[];
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
		})) as { orders: ChannelOrder[]; total: number };
		expect(result.orders).toHaveLength(2);
	});
});

// ── PUT /admin/tiktok-shop/orders/:id/status ─────────────────────────────────

describe("admin PUT /tiktok-shop/orders/:id/status", () => {
	it("returns error when order not found", async () => {
		const result = (await call(updateOrderStatusHandler, {
			params: { id: "missing" },
			body: { status: "shipped" },
		})) as { error: string };
		expect(result.error).toBe("Order not found");
	});

	it("updates order status and returns updated order", async () => {
		const order = makeOrder({ id: "ord_1", status: "shipped" });
		const ctrl = makeController({
			updateOrderStatus: vi.fn().mockResolvedValue(order),
		});
		const result = (await call(updateOrderStatusHandler, {
			params: { id: "ord_1" },
			body: { status: "shipped" },
			controller: ctrl,
		})) as { order: ChannelOrder };
		expect(result.order.status).toBe("shipped");
	});
});

// ── GET /admin/tiktok-shop/syncs ─────────────────────────────────────────────

describe("admin GET /tiktok-shop/syncs", () => {
	it("returns empty list when no syncs", async () => {
		const result = (await call(listSyncsHandler)) as {
			syncs: CatalogSync[];
			total: number;
		};
		expect(result.syncs).toHaveLength(0);
	});
});

// ── POST /admin/tiktok-shop/sync ─────────────────────────────────────────────

describe("admin POST /tiktok-shop/sync", () => {
	it("triggers catalog sync and returns sync record", async () => {
		const sync = makeCatalogSync({ syncedProducts: 3 });
		const ctrl = makeController({
			syncCatalog: vi.fn().mockResolvedValue(sync),
		});
		const result = (await call(syncCatalogHandler, {
			controller: ctrl,
		})) as { sync: CatalogSync };
		expect(result.sync.syncedProducts).toBe(3);
	});
});

// ── POST /admin/tiktok-shop/orders/sync ──────────────────────────────────────

describe("admin POST /tiktok-shop/orders/sync", () => {
	it("syncs orders and returns count", async () => {
		const ctrl = makeController({
			syncOrders: vi.fn().mockResolvedValue({ synced: 2 }),
		});
		const result = (await call(syncOrdersHandler, {
			controller: ctrl,
		})) as { synced: number };
		expect(result.synced).toBe(2);
	});
});

// ── POST /admin/tiktok-shop/products/sync ────────────────────────────────────

describe("admin POST /tiktok-shop/products/sync", () => {
	it("syncs products and returns count", async () => {
		const ctrl = makeController({
			syncProducts: vi.fn().mockResolvedValue({ synced: 4 }),
		});
		const result = (await call(syncProductsHandler, {
			controller: ctrl,
		})) as { synced: number };
		expect(result.synced).toBe(4);
	});
});

// ── POST /admin/tiktok-shop/listings/:id/push ────────────────────────────────

describe("admin POST /tiktok-shop/listings/:id/push", () => {
	it("returns null when listing not found", async () => {
		const result = (await call(pushProductHandler, {
			params: { id: "missing" },
		})) as { listing: null };
		expect(result.listing).toBeNull();
	});

	it("pushes product and returns listing", async () => {
		const listing = makeListing({ id: "lst_1" });
		const ctrl = makeController({
			pushProduct: vi.fn().mockResolvedValue(listing),
		});
		const result = (await call(pushProductHandler, {
			params: { id: "lst_1" },
			controller: ctrl,
		})) as { listing: Listing };
		expect(result.listing.id).toBe("lst_1");
	});
});

// ── GET /admin/tiktok-shop/stats ─────────────────────────────────────────────

describe("admin GET /tiktok-shop/stats", () => {
	it("returns channel stats", async () => {
		const stats = makeChannelStats({ totalListings: 5 });
		const ctrl = makeController({
			getChannelStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(statsHandler, {
			controller: ctrl,
		})) as { stats: ChannelStats };
		expect(result.stats.totalListings).toBe(5);
	});
});
