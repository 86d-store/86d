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
import { tagProductEndpoint } from "../admin/endpoints/tag-product";
import { untagProductEndpoint } from "../admin/endpoints/untag-product";
import { updateListingEndpoint } from "../admin/endpoints/update-listing";
import { updateOrderStatusEndpoint } from "../admin/endpoints/update-order-status";
import type {
	CatalogSync,
	ChannelOrder,
	ChannelStats,
	InstagramShopController,
	Listing,
} from "../service";

const mockVerifyConnection = vi.hoisted(() =>
	vi.fn().mockResolvedValue({ ok: true }),
);

vi.mock("../provider", () => ({
	MetaInstagramProvider: class {
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
		title: "Test Product",
		status: "active",
		syncStatus: "synced",
		instagramMediaIds: [],
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
		externalOrderId: "ig_order_1",
		instagramOrderId: "ig_order_1",
		status: "pending",
		items: [],
		subtotal: 3500,
		shippingFee: 0,
		platformFee: 100,
		total: 3600,
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
		totalProducts: 8,
		syncedProducts: 8,
		failedProducts: 0,
		startedAt: now,
		createdAt: now,
		...overrides,
	};
}

function makeChannelStats(overrides: Partial<ChannelStats> = {}): ChannelStats {
	return {
		totalListings: 8,
		activeListings: 7,
		pendingListings: 1,
		failedListings: 0,
		totalOrders: 3,
		pendingOrders: 1,
		shippedOrders: 1,
		deliveredOrders: 1,
		cancelledOrders: 0,
		totalRevenue: 10800,
		...overrides,
	};
}

function makeController(
	overrides: Partial<InstagramShopController> = {},
): InstagramShopController {
	return {
		createListing: vi.fn().mockResolvedValue(makeListing()),
		updateListing: vi.fn().mockResolvedValue(null),
		deleteListing: vi.fn().mockResolvedValue(false),
		getListing: vi.fn().mockResolvedValue(null),
		getListingByProduct: vi.fn().mockResolvedValue(null),
		listListings: vi.fn().mockResolvedValue([]),
		tagProduct: vi.fn().mockResolvedValue(null),
		untagProduct: vi.fn().mockResolvedValue(null),
		getProductTags: vi.fn().mockResolvedValue([]),
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
		controller?: InstagramShopController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: {
				instagramShop: opts.controller ?? makeController(),
			},
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const settingsHandler = extractHandler(
	createGetSettingsEndpoint({
		accessToken: "token_1",
		businessId: "biz_1",
		catalogId: "catalog_1",
		commerceAccountId: "commerce_1",
	}),
);
const settingsEmptyHandler = extractHandler(createGetSettingsEndpoint({}));
const createListingHandler = extractHandler(createListingEndpoint);
const updateListingHandler = extractHandler(updateListingEndpoint);
const deleteListingHandler = extractHandler(deleteListingEndpoint);
const getListingHandler = extractHandler(getListingEndpoint);
const listListingsHandler = extractHandler(listListingsEndpoint);
const tagProductHandler = extractHandler(tagProductEndpoint);
const untagProductHandler = extractHandler(untagProductEndpoint);
const getOrderHandler = extractHandler(getOrderEndpoint);
const listOrdersHandler = extractHandler(listOrdersEndpoint);
const updateOrderStatusHandler = extractHandler(updateOrderStatusEndpoint);
const listSyncsHandler = extractHandler(listSyncsEndpoint);
const syncCatalogHandler = extractHandler(syncCatalogEndpoint);
const syncOrdersHandler = extractHandler(syncOrdersEndpoint);
const syncProductsHandler = extractHandler(syncProductsEndpoint);
const pushProductHandler = extractHandler(pushProductEndpoint);
const statsHandler = extractHandler(statsEndpoint);

// ── GET /admin/instagram-shop/settings ───────────────────────────────────────

describe("admin GET /instagram-shop/settings", () => {
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
		mockVerifyConnection.mockResolvedValueOnce({ ok: true });
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
			error: "Token expired",
		});
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { status: string; error: string };
		expect(result.status).toBe("error");
		expect(result.error).toBe("Token expired");
	});
});

// ── POST /admin/instagram-shop/listings/create ───────────────────────────────

describe("admin POST /instagram-shop/listings/create", () => {
	it("creates a listing and returns it", async () => {
		const listing = makeListing({ title: "Sunglasses" });
		const ctrl = makeController({
			createListing: vi.fn().mockResolvedValue(listing),
		});
		const result = (await call(createListingHandler, {
			body: { localProductId: "prod_1", title: "Sunglasses" },
			controller: ctrl,
		})) as { listing: Listing };
		expect(result.listing.title).toBe("Sunglasses");
	});
});

// ── PUT /admin/instagram-shop/listings/:id/update ────────────────────────────

describe("admin PUT /instagram-shop/listings/:id/update", () => {
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

// ── DELETE /admin/instagram-shop/listings/:id/delete ─────────────────────────

describe("admin DELETE /instagram-shop/listings/:id/delete", () => {
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

// ── GET /admin/instagram-shop/listings/:id ───────────────────────────────────

describe("admin GET /instagram-shop/listings/:id", () => {
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

// ── GET /admin/instagram-shop/listings ───────────────────────────────────────

describe("admin GET /instagram-shop/listings", () => {
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

// ── POST /admin/instagram-shop/listings/:id/tag ──────────────────────────────

describe("admin POST /instagram-shop/listings/:id/tag", () => {
	it("returns error when listing not found", async () => {
		const result = (await call(tagProductHandler, {
			params: { id: "missing" },
			body: { mediaId: "media_1" },
		})) as { error: string };
		expect(result.error).toBe("Listing not found");
	});

	it("tags product and returns listing", async () => {
		const listing = makeListing({
			id: "lst_1",
			instagramMediaIds: ["media_1"],
		});
		const ctrl = makeController({
			tagProduct: vi.fn().mockResolvedValue(listing),
		});
		const result = (await call(tagProductHandler, {
			params: { id: "lst_1" },
			body: { mediaId: "media_1" },
			controller: ctrl,
		})) as { listing: Listing };
		expect(result.listing.id).toBe("lst_1");
		expect(ctrl.tagProduct).toHaveBeenCalledWith("lst_1", "media_1");
	});
});

// ── POST /admin/instagram-shop/listings/:id/untag ────────────────────────────

describe("admin POST /instagram-shop/listings/:id/untag", () => {
	it("returns error when listing not found", async () => {
		const result = (await call(untagProductHandler, {
			params: { id: "missing" },
			body: { mediaId: "media_1" },
		})) as { error: string };
		expect(result.error).toBe("Listing not found");
	});

	it("untags product and returns listing", async () => {
		const listing = makeListing({ id: "lst_1", instagramMediaIds: [] });
		const ctrl = makeController({
			untagProduct: vi.fn().mockResolvedValue(listing),
		});
		const result = (await call(untagProductHandler, {
			params: { id: "lst_1" },
			body: { mediaId: "media_1" },
			controller: ctrl,
		})) as { listing: Listing };
		expect(result.listing.id).toBe("lst_1");
		expect(ctrl.untagProduct).toHaveBeenCalledWith("lst_1", "media_1");
	});
});

// ── GET /admin/instagram-shop/orders/:id ─────────────────────────────────────

describe("admin GET /instagram-shop/orders/:id", () => {
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

// ── GET /admin/instagram-shop/orders ─────────────────────────────────────────

describe("admin GET /instagram-shop/orders", () => {
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

// ── PUT /admin/instagram-shop/orders/:id/status ──────────────────────────────

describe("admin PUT /instagram-shop/orders/:id/status", () => {
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

// ── GET /admin/instagram-shop/syncs ──────────────────────────────────────────

describe("admin GET /instagram-shop/syncs", () => {
	it("returns empty list when no syncs", async () => {
		const result = (await call(listSyncsHandler)) as {
			syncs: CatalogSync[];
			total: number;
		};
		expect(result.syncs).toHaveLength(0);
	});

	it("returns syncs from controller", async () => {
		const syncs = [makeCatalogSync()];
		const ctrl = makeController({
			listSyncs: vi.fn().mockResolvedValue(syncs),
		});
		const result = (await call(listSyncsHandler, {
			controller: ctrl,
		})) as { syncs: CatalogSync[]; total: number };
		expect(result.syncs).toHaveLength(1);
	});
});

// ── POST /admin/instagram-shop/sync ──────────────────────────────────────────

describe("admin POST /instagram-shop/sync", () => {
	it("triggers catalog sync and returns sync record", async () => {
		const sync = makeCatalogSync({ syncedProducts: 5 });
		const ctrl = makeController({
			syncCatalog: vi.fn().mockResolvedValue(sync),
		});
		const result = (await call(syncCatalogHandler, {
			controller: ctrl,
		})) as { sync: CatalogSync };
		expect(result.sync.syncedProducts).toBe(5);
	});
});

// ── POST /admin/instagram-shop/orders/sync ───────────────────────────────────

describe("admin POST /instagram-shop/orders/sync", () => {
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

// ── POST /admin/instagram-shop/products/sync ─────────────────────────────────

describe("admin POST /instagram-shop/products/sync", () => {
	it("syncs products and returns count", async () => {
		const ctrl = makeController({
			syncProducts: vi.fn().mockResolvedValue({ synced: 3 }),
		});
		const result = (await call(syncProductsHandler, {
			controller: ctrl,
		})) as { synced: number };
		expect(result.synced).toBe(3);
	});
});

// ── POST /admin/instagram-shop/listings/:id/push ─────────────────────────────

describe("admin POST /instagram-shop/listings/:id/push", () => {
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

// ── GET /admin/instagram-shop/stats ──────────────────────────────────────────

describe("admin GET /instagram-shop/stats", () => {
	it("returns channel stats", async () => {
		const stats = makeChannelStats({ totalListings: 8 });
		const ctrl = makeController({
			getChannelStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(statsHandler, {
			controller: ctrl,
		})) as { stats: ChannelStats };
		expect(result.stats.totalListings).toBe(8);
	});
});
