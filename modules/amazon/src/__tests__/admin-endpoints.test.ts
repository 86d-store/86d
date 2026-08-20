import { describe, expect, it, vi } from "vitest";
import { cancelOrderEndpoint } from "../admin/endpoints/cancel-order";
import { createListingEndpoint } from "../admin/endpoints/create-listing";
import { deleteListingEndpoint } from "../admin/endpoints/delete-listing";
import { getListingEndpoint } from "../admin/endpoints/get-listing";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { inventoryHealthEndpoint } from "../admin/endpoints/inventory-health";
import { listListingsEndpoint } from "../admin/endpoints/list-listings";
import { listOrdersEndpoint } from "../admin/endpoints/list-orders";
import { pushListingEndpoint } from "../admin/endpoints/push-listing";
import { shipOrderEndpoint } from "../admin/endpoints/ship-order";
import { statsEndpoint } from "../admin/endpoints/stats";
import { syncInventoryEndpoint } from "../admin/endpoints/sync-inventory";
import { syncListingsEndpoint } from "../admin/endpoints/sync-listings";
import { syncOrdersEndpoint } from "../admin/endpoints/sync-orders";
import { updateListingEndpoint } from "../admin/endpoints/update-listing";
import type {
	AmazonController,
	AmazonOrder,
	ChannelStats,
	InventoryHealth,
	InventorySync,
	Listing,
} from "../service";

const mockVerifyConnection = vi.hoisted(() =>
	vi.fn().mockResolvedValue({ ok: true, sellerId: "AXXXXXXXX" }),
);

vi.mock("../provider", () => ({
	AmazonProvider: class {
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
		sku: "SKU-001",
		title: "Test Product",
		status: "active",
		fulfillmentChannel: "FBM",
		price: 2999,
		quantity: 10,
		condition: "new",
		buyBoxOwned: false,
		metadata: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeOrder(overrides: Partial<AmazonOrder> = {}): AmazonOrder {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		amazonOrderId: "AMZ-001",
		status: "pending",
		fulfillmentChannel: "FBM",
		items: [],
		orderTotal: 2999,
		shippingTotal: 0,
		marketplaceFee: 450,
		netProceeds: 2549,
		shippingAddress: { city: "Seattle" },
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeInventorySync(
	overrides: Partial<InventorySync> = {},
): InventorySync {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		status: "synced",
		totalSkus: 10,
		updatedSkus: 8,
		failedSkus: 0,
		startedAt: now,
		createdAt: now,
		...overrides,
	};
}

function makeInventoryHealth(
	overrides: Partial<InventoryHealth> = {},
): InventoryHealth {
	return {
		totalSkus: 20,
		lowStock: 3,
		outOfStock: 2,
		fbaCount: 10,
		fbmCount: 10,
		...overrides,
	};
}

function makeChannelStats(overrides: Partial<ChannelStats> = {}): ChannelStats {
	return {
		totalListings: 5,
		active: 4,
		inactive: 1,
		suppressed: 0,
		incomplete: 0,
		fba: 2,
		fbm: 3,
		totalOrders: 10,
		totalRevenue: 29990,
		...overrides,
	};
}

function makeController(
	overrides: Partial<AmazonController> = {},
): AmazonController {
	return {
		createListing: vi.fn().mockResolvedValue(makeListing()),
		updateListing: vi.fn().mockResolvedValue(null),
		deleteListing: vi.fn().mockResolvedValue(false),
		getListing: vi.fn().mockResolvedValue(null),
		getListingByProduct: vi.fn().mockResolvedValue(null),
		getListingByAsin: vi.fn().mockResolvedValue(null),
		listListings: vi.fn().mockResolvedValue([]),
		syncInventory: vi.fn().mockResolvedValue(makeInventorySync()),
		getLastInventorySync: vi.fn().mockResolvedValue(null),
		receiveOrder: vi.fn().mockResolvedValue(makeOrder()),
		getOrder: vi.fn().mockResolvedValue(null),
		shipOrder: vi.fn().mockResolvedValue(null),
		cancelOrder: vi.fn().mockResolvedValue(null),
		listOrders: vi.fn().mockResolvedValue([]),
		getChannelStats: vi.fn().mockResolvedValue(makeChannelStats()),
		getInventoryHealth: vi.fn().mockResolvedValue(makeInventoryHealth()),
		pushListing: vi.fn().mockResolvedValue(null),
		syncListings: vi.fn().mockResolvedValue({ synced: 0 }),
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
		controller?: AmazonController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { amazon: opts.controller ?? makeController() } },
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const settingsHandler = extractHandler(
	createGetSettingsEndpoint({
		sellerId: "SELLER_1",
		clientId: "CLIENT_1",
		clientSecret: "SECRET_1",
		refreshToken: "REFRESH_1",
	}),
);
const settingsEmptyHandler = extractHandler(createGetSettingsEndpoint({}));
const createListingHandler = extractHandler(createListingEndpoint);
const updateListingHandler = extractHandler(updateListingEndpoint);
const deleteListingHandler = extractHandler(deleteListingEndpoint);
const getListingHandler = extractHandler(getListingEndpoint);
const listListingsHandler = extractHandler(listListingsEndpoint);
const shipOrderHandler = extractHandler(shipOrderEndpoint);
const cancelOrderHandler = extractHandler(cancelOrderEndpoint);
const listOrdersHandler = extractHandler(listOrdersEndpoint);
const statsHandler = extractHandler(statsEndpoint);
const syncInventoryHandler = extractHandler(syncInventoryEndpoint);
const inventoryHealthHandler = extractHandler(inventoryHealthEndpoint);
const pushListingHandler = extractHandler(pushListingEndpoint);
const syncListingsHandler = extractHandler(syncListingsEndpoint);
const syncOrdersHandler = extractHandler(syncOrdersEndpoint);

// ── GET /admin/amazon/settings ────────────────────────────────────────────────

describe("admin GET /amazon/settings", () => {
	it("returns not_configured when no credentials are set", async () => {
		const result = (await settingsEmptyHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { status: string; configured: boolean };
		expect(result.status).toBe("not_configured");
		expect(result.configured).toBe(false);
	});

	it("reports unavailable when API credentials are valid but notifications are disabled", async () => {
		mockVerifyConnection.mockResolvedValueOnce({
			ok: true,
			sellerId: "SELLER_1",
		});
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { status: string; configured: boolean };
		expect(result.status).toBe("error");
		expect(result.configured).toBe(false);
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

	it("masks clientId in response", async () => {
		mockVerifyConnection.mockResolvedValueOnce({
			ok: true,
			sellerId: "SELLER_1",
		});
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { clientId: string };
		expect(result.clientId).toMatch(/\.\.\./);
	});
});

// ── POST /admin/amazon/listings/create ───────────────────────────────────────

describe("admin POST /amazon/listings/create", () => {
	it("creates a listing and returns it", async () => {
		const listing = makeListing({ sku: "SKU-XYZ", title: "My Product" });
		const ctrl = makeController({
			createListing: vi.fn().mockResolvedValue(listing),
		});
		const result = (await call(createListingHandler, {
			body: {
				localProductId: "prod_1",
				sku: "SKU-XYZ",
				title: "My Product",
				price: 2999,
			},
			controller: ctrl,
		})) as { listing: Listing };
		expect(result.listing.sku).toBe("SKU-XYZ");
		expect(result.listing.title).toBe("My Product");
	});

	it("forwards all listing fields to controller", async () => {
		const ctrl = makeController();
		await call(createListingHandler, {
			body: {
				localProductId: "prod_2",
				sku: "SKU-ABC",
				title: "Another Product",
				price: 4999,
				fulfillmentChannel: "FBA",
				condition: "new",
				quantity: 5,
			},
			controller: ctrl,
		});
		expect(ctrl.createListing).toHaveBeenCalledWith(
			expect.objectContaining({
				sku: "SKU-ABC",
				fulfillmentChannel: "FBA",
				quantity: 5,
			}),
		);
	});
});

// ── PUT /admin/amazon/listings/:id/update ────────────────────────────────────

describe("admin PUT /amazon/listings/:id/update", () => {
	it("returns updated listing", async () => {
		const updated = makeListing({ id: "lst_1", price: 3999 });
		const ctrl = makeController({
			updateListing: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateListingHandler, {
			params: { id: "lst_1" },
			body: { price: 3999 },
			controller: ctrl,
		})) as { listing: Listing };
		expect(result.listing.price).toBe(3999);
		expect(ctrl.updateListing).toHaveBeenCalledWith(
			"lst_1",
			expect.objectContaining({ price: 3999 }),
		);
	});

	it("returns null listing when not found", async () => {
		const result = (await call(updateListingHandler, {
			params: { id: "missing" },
			body: {},
		})) as { listing: null };
		expect(result.listing).toBeNull();
	});
});

// ── DELETE /admin/amazon/listings/:id/delete ─────────────────────────────────

describe("admin DELETE /amazon/listings/:id/delete", () => {
	it("returns deleted: false when listing not found", async () => {
		const result = (await call(deleteListingHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("returns deleted: true when listing is deleted", async () => {
		const ctrl = makeController({
			deleteListing: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteListingHandler, {
			params: { id: "lst_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
		expect(ctrl.deleteListing).toHaveBeenCalledWith("lst_1");
	});
});

// ── GET /admin/amazon/listings/:id ───────────────────────────────────────────

describe("admin GET /amazon/listings/:id", () => {
	it("returns null when not found", async () => {
		const result = (await call(getListingHandler, {
			params: { id: "missing" },
		})) as { listing: null };
		expect(result.listing).toBeNull();
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

// ── GET /admin/amazon/listings ───────────────────────────────────────────────

describe("admin GET /amazon/listings", () => {
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
		expect(result.total).toBe(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listListingsHandler, {
			query: { status: "active" },
			controller: ctrl,
		});
		expect(ctrl.listListings).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" }),
		);
	});
});

// ── PUT /admin/amazon/orders/:id/ship ────────────────────────────────────────

describe("admin PUT /amazon/orders/:id/ship", () => {
	it("ships order and returns it", async () => {
		const order = makeOrder({ id: "ord_1", status: "shipped" });
		const ctrl = makeController({
			shipOrder: vi.fn().mockResolvedValue(order),
		});
		const result = (await call(shipOrderHandler, {
			params: { id: "ord_1" },
			body: { trackingNumber: "1Z999", carrier: "UPS" },
			controller: ctrl,
		})) as { order: AmazonOrder };
		expect(result.order.status).toBe("shipped");
		expect(ctrl.shipOrder).toHaveBeenCalledWith("ord_1", "1Z999", "UPS");
	});

	it("returns null order when not found", async () => {
		const result = (await call(shipOrderHandler, {
			params: { id: "missing" },
			body: { trackingNumber: "1Z999", carrier: "UPS" },
		})) as { order: null };
		expect(result.order).toBeNull();
	});
});

// ── PUT /admin/amazon/orders/:id/cancel ──────────────────────────────────────

describe("admin PUT /amazon/orders/:id/cancel", () => {
	it("cancels order and returns it", async () => {
		const order = makeOrder({ id: "ord_1", status: "cancelled" });
		const ctrl = makeController({
			cancelOrder: vi.fn().mockResolvedValue(order),
		});
		const result = (await call(cancelOrderHandler, {
			params: { id: "ord_1" },
			controller: ctrl,
		})) as { order: AmazonOrder };
		expect(result.order.status).toBe("cancelled");
		expect(ctrl.cancelOrder).toHaveBeenCalledWith("ord_1");
	});
});

// ── GET /admin/amazon/orders ─────────────────────────────────────────────────

describe("admin GET /amazon/orders", () => {
	it("returns empty list when no orders", async () => {
		const result = (await call(listOrdersHandler)) as {
			orders: AmazonOrder[];
			total: number;
		};
		expect(result.orders).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns orders from controller", async () => {
		const orders = [makeOrder(), makeOrder()];
		const ctrl = makeController({
			listOrders: vi.fn().mockResolvedValue(orders),
		});
		const result = (await call(listOrdersHandler, {
			controller: ctrl,
		})) as { orders: AmazonOrder[]; total: number };
		expect(result.orders).toHaveLength(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listOrdersHandler, {
			query: { status: "shipped" },
			controller: ctrl,
		});
		expect(ctrl.listOrders).toHaveBeenCalledWith(
			expect.objectContaining({ status: "shipped" }),
		);
	});
});

// ── GET /admin/amazon/stats ───────────────────────────────────────────────────

describe("admin GET /amazon/stats", () => {
	it("returns channel stats", async () => {
		const stats = makeChannelStats({ totalListings: 5, active: 4 });
		const ctrl = makeController({
			getChannelStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(statsHandler, {
			controller: ctrl,
		})) as { stats: ChannelStats };
		expect(result.stats.totalListings).toBe(5);
		expect(result.stats.active).toBe(4);
	});
});

// ── POST /admin/amazon/inventory/sync ────────────────────────────────────────

describe("admin POST /amazon/inventory/sync", () => {
	it("triggers inventory sync and returns sync record", async () => {
		const sync = makeInventorySync({ status: "synced", updatedSkus: 5 });
		const ctrl = makeController({
			syncInventory: vi.fn().mockResolvedValue(sync),
		});
		const result = (await call(syncInventoryHandler, {
			controller: ctrl,
		})) as { sync: InventorySync };
		expect(result.sync.status).toBe("synced");
		expect(result.sync.updatedSkus).toBe(5);
	});
});

// ── GET /admin/amazon/inventory/health ───────────────────────────────────────

describe("admin GET /amazon/inventory/health", () => {
	it("returns inventory health metrics", async () => {
		const health = makeInventoryHealth({ totalSkus: 20, fbaCount: 15 });
		const ctrl = makeController({
			getInventoryHealth: vi.fn().mockResolvedValue(health),
		});
		const result = (await call(inventoryHealthHandler, {
			controller: ctrl,
		})) as { health: InventoryHealth };
		expect(result.health.totalSkus).toBe(20);
		expect(result.health.fbaCount).toBe(15);
	});
});

// ── POST /admin/amazon/listings/:id/push ─────────────────────────────────────

describe("admin POST /amazon/listings/:id/push", () => {
	it("returns null when listing not found", async () => {
		const result = (await call(pushListingHandler, {
			params: { id: "missing" },
		})) as { listing: null };
		expect(result.listing).toBeNull();
	});

	it("pushes listing and returns updated record", async () => {
		const listing = makeListing({ id: "lst_1" });
		const ctrl = makeController({
			pushListing: vi.fn().mockResolvedValue(listing),
		});
		const result = (await call(pushListingHandler, {
			params: { id: "lst_1" },
			controller: ctrl,
		})) as { listing: Listing };
		expect(result.listing.id).toBe("lst_1");
		expect(ctrl.pushListing).toHaveBeenCalledWith("lst_1");
	});
});

// ── POST /admin/amazon/listings/sync ─────────────────────────────────────────

describe("admin POST /amazon/listings/sync", () => {
	it("syncs listings and returns count", async () => {
		const ctrl = makeController({
			syncListings: vi.fn().mockResolvedValue({ synced: 7 }),
		});
		const result = (await call(syncListingsHandler, {
			controller: ctrl,
		})) as { synced: number };
		expect(result.synced).toBe(7);
	});
});

// ── POST /admin/amazon/orders/sync ───────────────────────────────────────────

describe("admin POST /amazon/orders/sync", () => {
	it("syncs orders and returns count", async () => {
		const ctrl = makeController({
			syncOrders: vi.fn().mockResolvedValue({ synced: 3 }),
		});
		const result = (await call(syncOrdersHandler, {
			body: {},
			controller: ctrl,
		})) as { synced: number };
		expect(result.synced).toBe(3);
	});

	it("forwards createdAfter filter to controller", async () => {
		const ctrl = makeController();
		await call(syncOrdersHandler, {
			body: { createdAfter: "2024-01-01" },
			controller: ctrl,
		});
		expect(ctrl.syncOrders).toHaveBeenCalledWith(
			expect.objectContaining({ createdAfter: "2024-01-01" }),
		);
	});
});
