import { describe, expect, it, vi } from "vitest";
import { createCollectionEndpoint } from "../admin/endpoints/create-collection";
import { createListingEndpoint } from "../admin/endpoints/create-listing";
import { deleteCollectionEndpoint } from "../admin/endpoints/delete-collection";
import { deleteListingEndpoint } from "../admin/endpoints/delete-listing";
import { getListingEndpoint } from "../admin/endpoints/get-listing";
import { getOrderEndpoint } from "../admin/endpoints/get-order";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { listCollectionsEndpoint } from "../admin/endpoints/list-collections";
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
	Collection,
	FacebookShopController,
	Listing,
} from "../service";

const mockVerifyConnection = vi.hoisted(() =>
	vi.fn().mockResolvedValue({ ok: true }),
);

vi.mock("../provider", () => ({
	MetaCommerceProvider: class {
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
		externalOrderId: "fb_order_1",
		status: "pending",
		items: [],
		subtotal: 2999,
		shippingFee: 0,
		platformFee: 100,
		total: 3099,
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
		totalProducts: 10,
		syncedProducts: 10,
		failedProducts: 0,
		startedAt: now,
		createdAt: now,
		...overrides,
	};
}

function makeCollection(overrides: Partial<Collection> = {}): Collection {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Summer Collection",
		productIds: [],
		status: "active",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeChannelStats(overrides: Partial<ChannelStats> = {}): ChannelStats {
	return {
		totalListings: 5,
		activeListings: 4,
		pendingListings: 1,
		failedListings: 0,
		totalOrders: 3,
		pendingOrders: 1,
		shippedOrders: 1,
		deliveredOrders: 1,
		cancelledOrders: 0,
		totalRevenue: 9297,
		...overrides,
	};
}

function makeController(
	overrides: Partial<FacebookShopController> = {},
): FacebookShopController {
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
		createCollection: vi.fn().mockResolvedValue(makeCollection()),
		deleteCollection: vi.fn().mockResolvedValue(false),
		listCollections: vi.fn().mockResolvedValue([]),
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
		controller?: FacebookShopController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: {
				facebookShop: opts.controller ?? makeController(),
			},
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const settingsHandler = extractHandler(
	createGetSettingsEndpoint({
		accessToken: "token_1",
		pageId: "page_1",
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
const getOrderHandler = extractHandler(getOrderEndpoint);
const listOrdersHandler = extractHandler(listOrdersEndpoint);
const updateOrderStatusHandler = extractHandler(updateOrderStatusEndpoint);
const listSyncsHandler = extractHandler(listSyncsEndpoint);
const syncCatalogHandler = extractHandler(syncCatalogEndpoint);
const syncOrdersHandler = extractHandler(syncOrdersEndpoint);
const syncProductsHandler = extractHandler(syncProductsEndpoint);
const pushProductHandler = extractHandler(pushProductEndpoint);
const statsHandler = extractHandler(statsEndpoint);
const createCollectionHandler = extractHandler(createCollectionEndpoint);
const deleteCollectionHandler = extractHandler(deleteCollectionEndpoint);
const listCollectionsHandler = extractHandler(listCollectionsEndpoint);

// ── GET /admin/facebook-shop/settings ────────────────────────────────────────

describe("admin GET /facebook-shop/settings", () => {
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

// ── POST /admin/facebook-shop/listings/create ────────────────────────────────

describe("admin POST /facebook-shop/listings/create", () => {
	it("creates a listing and returns it", async () => {
		const listing = makeListing({ title: "Blue Jeans" });
		const ctrl = makeController({
			createListing: vi.fn().mockResolvedValue(listing),
		});
		const result = (await call(createListingHandler, {
			body: { localProductId: "prod_1", title: "Blue Jeans" },
			controller: ctrl,
		})) as { listing: Listing };
		expect(result.listing.title).toBe("Blue Jeans");
	});

	it("forwards optional fields to controller", async () => {
		const ctrl = makeController();
		await call(createListingHandler, {
			body: {
				localProductId: "prod_2",
				title: "Red Shoes",
				price: 5999,
				status: "draft",
			},
			controller: ctrl,
		});
		expect(ctrl.createListing).toHaveBeenCalledWith(
			expect.objectContaining({ price: 5999, status: "draft" }),
		);
	});
});

// ── PUT /admin/facebook-shop/listings/:id/update ─────────────────────────────

describe("admin PUT /facebook-shop/listings/:id/update", () => {
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

	it("returns error when listing not found", async () => {
		const result = (await call(updateListingHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string };
		expect(result.error).toBe("Listing not found");
	});
});

// ── DELETE /admin/facebook-shop/listings/:id/delete ──────────────────────────

describe("admin DELETE /facebook-shop/listings/:id/delete", () => {
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

// ── GET /admin/facebook-shop/listings/:id ────────────────────────────────────

describe("admin GET /facebook-shop/listings/:id", () => {
	it("returns error when listing not found", async () => {
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

// ── GET /admin/facebook-shop/listings ────────────────────────────────────────

describe("admin GET /facebook-shop/listings", () => {
	it("returns empty list when no listings", async () => {
		const result = (await call(listListingsHandler)) as {
			listings: Listing[];
			total: number;
		};
		expect(result.listings).toHaveLength(0);
		expect(result.total).toBe(0);
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

	it("forwards status and syncStatus filters", async () => {
		const ctrl = makeController();
		await call(listListingsHandler, {
			query: { status: "active", syncStatus: "synced" },
			controller: ctrl,
		});
		expect(ctrl.listListings).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active", syncStatus: "synced" }),
		);
	});
});

// ── GET /admin/facebook-shop/orders/:id ──────────────────────────────────────

describe("admin GET /facebook-shop/orders/:id", () => {
	it("returns error when order not found", async () => {
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

// ── GET /admin/facebook-shop/orders ──────────────────────────────────────────

describe("admin GET /facebook-shop/orders", () => {
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

// ── PUT /admin/facebook-shop/orders/:id/status ───────────────────────────────

describe("admin PUT /facebook-shop/orders/:id/status", () => {
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
			body: { status: "shipped", trackingNumber: "1Z999" },
			controller: ctrl,
		})) as { order: ChannelOrder };
		expect(result.order.status).toBe("shipped");
		expect(ctrl.updateOrderStatus).toHaveBeenCalledWith(
			"ord_1",
			"shipped",
			"1Z999",
			undefined,
		);
	});
});

// ── GET /admin/facebook-shop/syncs ───────────────────────────────────────────

describe("admin GET /facebook-shop/syncs", () => {
	it("returns empty list when no syncs", async () => {
		const result = (await call(listSyncsHandler)) as {
			syncs: CatalogSync[];
			total: number;
		};
		expect(result.syncs).toHaveLength(0);
	});

	it("returns syncs from controller", async () => {
		const syncs = [makeCatalogSync(), makeCatalogSync()];
		const ctrl = makeController({
			listSyncs: vi.fn().mockResolvedValue(syncs),
		});
		const result = (await call(listSyncsHandler, {
			controller: ctrl,
		})) as { syncs: CatalogSync[]; total: number };
		expect(result.syncs).toHaveLength(2);
	});
});

// ── POST /admin/facebook-shop/sync ───────────────────────────────────────────

describe("admin POST /facebook-shop/sync", () => {
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

// ── POST /admin/facebook-shop/orders/sync ────────────────────────────────────

describe("admin POST /facebook-shop/orders/sync", () => {
	it("syncs orders and returns count", async () => {
		const ctrl = makeController({
			syncOrders: vi.fn().mockResolvedValue({ synced: 4 }),
		});
		const result = (await call(syncOrdersHandler, {
			controller: ctrl,
		})) as { synced: number };
		expect(result.synced).toBe(4);
	});
});

// ── POST /admin/facebook-shop/products/sync ──────────────────────────────────

describe("admin POST /facebook-shop/products/sync", () => {
	it("syncs products and returns count", async () => {
		const ctrl = makeController({
			syncProducts: vi.fn().mockResolvedValue({ synced: 6 }),
		});
		const result = (await call(syncProductsHandler, {
			controller: ctrl,
		})) as { synced: number };
		expect(result.synced).toBe(6);
	});
});

// ── POST /admin/facebook-shop/listings/:id/push ──────────────────────────────

describe("admin POST /facebook-shop/listings/:id/push", () => {
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
		expect(ctrl.pushProduct).toHaveBeenCalledWith("lst_1");
	});
});

// ── GET /admin/facebook-shop/stats ───────────────────────────────────────────

describe("admin GET /facebook-shop/stats", () => {
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

// ── POST /admin/facebook-shop/collections/create ─────────────────────────────

describe("admin POST /facebook-shop/collections/create", () => {
	it("creates a collection and returns it", async () => {
		const collection = makeCollection({ name: "Holiday Sale" });
		const ctrl = makeController({
			createCollection: vi.fn().mockResolvedValue(collection),
		});
		const result = (await call(createCollectionHandler, {
			body: { name: "Holiday Sale", productIds: ["prod_1"] },
			controller: ctrl,
		})) as { collection: Collection };
		expect(result.collection.name).toBe("Holiday Sale");
		expect(ctrl.createCollection).toHaveBeenCalledWith("Holiday Sale", [
			"prod_1",
		]);
	});
});

// ── DELETE /admin/facebook-shop/collections/:id/delete ───────────────────────

describe("admin DELETE /facebook-shop/collections/:id/delete", () => {
	it("returns deleted: false when not found", async () => {
		const result = (await call(deleteCollectionHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("returns deleted: true when deleted", async () => {
		const ctrl = makeController({
			deleteCollection: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteCollectionHandler, {
			params: { id: "col_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

// ── GET /admin/facebook-shop/collections ─────────────────────────────────────

describe("admin GET /facebook-shop/collections", () => {
	it("returns empty list when no collections", async () => {
		const result = (await call(listCollectionsHandler)) as {
			collections: Collection[];
			total: number;
		};
		expect(result.collections).toHaveLength(0);
	});

	it("returns collections from controller", async () => {
		const collections = [makeCollection(), makeCollection({ name: "Winter" })];
		const ctrl = makeController({
			listCollections: vi.fn().mockResolvedValue(collections),
		});
		const result = (await call(listCollectionsHandler, {
			controller: ctrl,
		})) as { collections: Collection[]; total: number };
		expect(result.collections).toHaveLength(2);
	});
});
