import { describe, expect, it, vi } from "vitest";
import { cancelDropEndpoint } from "../admin/endpoints/cancel-drop";
import { createDropEndpoint } from "../admin/endpoints/create-drop";
import { createListingEndpoint } from "../admin/endpoints/create-listing";
import { deleteListingEndpoint } from "../admin/endpoints/delete-listing";
import { dropStatsEndpoint } from "../admin/endpoints/drop-stats";
import { getDropEndpoint } from "../admin/endpoints/get-drop";
import { getListingEndpoint } from "../admin/endpoints/get-listing";
import { getOrderEndpoint } from "../admin/endpoints/get-order";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { listDropsEndpoint } from "../admin/endpoints/list-drops";
import { listListingsEndpoint } from "../admin/endpoints/list-listings";
import { listOrdersEndpoint } from "../admin/endpoints/list-orders";
import { statsEndpoint } from "../admin/endpoints/stats";
import { updateListingEndpoint } from "../admin/endpoints/update-listing";
import { updateOrderStatusEndpoint } from "../admin/endpoints/update-order-status";
import type {
	ChannelOrder,
	ChannelStats,
	DropStats,
	Listing,
	ProductDrop,
	XShopController,
} from "../service";

const mockVerifyConnection = vi.hoisted(() =>
	vi.fn().mockResolvedValue({
		ok: true,
		userId: "uid_1",
		username: "myshop",
		name: "My Shop",
	}),
);

vi.mock("../provider", () => ({
	XApiProvider: class {
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
		title: "Exclusive Merch",
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
		externalOrderId: "x_order_1",
		status: "pending",
		items: [],
		subtotal: 2999,
		shippingFee: 0,
		platformFee: 150,
		total: 3149,
		shippingAddress: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeProductDrop(overrides: Partial<ProductDrop> = {}): ProductDrop {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Summer Drop",
		productIds: ["prod_1"],
		launchDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
		status: "scheduled",
		impressions: 0,
		clicks: 0,
		conversions: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeDropStats(overrides: Partial<DropStats> = {}): DropStats {
	return {
		impressions: 1000,
		clicks: 100,
		conversions: 10,
		conversionRate: 0.1,
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
		totalRevenue: 9447,
		...overrides,
	};
}

function makeController(
	overrides: Partial<XShopController> = {},
): XShopController {
	return {
		createListing: vi.fn().mockResolvedValue(makeListing()),
		updateListing: vi.fn().mockResolvedValue(null),
		deleteListing: vi.fn().mockResolvedValue(false),
		getListing: vi.fn().mockResolvedValue(null),
		getListingByProduct: vi.fn().mockResolvedValue(null),
		listListings: vi.fn().mockResolvedValue([]),
		receiveOrder: vi.fn().mockResolvedValue(makeOrder()),
		getOrder: vi.fn().mockResolvedValue(null),
		updateOrderStatus: vi.fn().mockResolvedValue(null),
		listOrders: vi.fn().mockResolvedValue([]),
		createDrop: vi.fn().mockResolvedValue(makeProductDrop()),
		getDrop: vi.fn().mockResolvedValue(null),
		cancelDrop: vi.fn().mockResolvedValue(null),
		listDrops: vi.fn().mockResolvedValue([]),
		getDropStats: vi.fn().mockResolvedValue(null),
		getChannelStats: vi.fn().mockResolvedValue(makeChannelStats()),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: XShopController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { xShop: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const settingsHandler = extractHandler(
	createGetSettingsEndpoint({
		apiKey: "api_key_1",
		apiSecret: "api_secret_1",
		accessToken: "token_1",
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
const createDropHandler = extractHandler(createDropEndpoint);
const getDropHandler = extractHandler(getDropEndpoint);
const cancelDropHandler = extractHandler(cancelDropEndpoint);
const listDropsHandler = extractHandler(listDropsEndpoint);
const dropStatsHandler = extractHandler(dropStatsEndpoint);
const statsHandler = extractHandler(statsEndpoint);

// ── GET /admin/x-shop/settings ───────────────────────────────────────────────

describe("admin GET /x-shop/settings", () => {
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
			userId: "uid_1",
			username: "myshop",
			name: "My Shop",
		});
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { status: string; configured: boolean; username: string };
		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
		expect(result.username).toBe("myshop");
	});

	it("returns error when verification fails", async () => {
		mockVerifyConnection.mockResolvedValueOnce({
			ok: false,
			error: "Rate limited",
		});
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { status: string; error: string };
		expect(result.status).toBe("error");
		expect(result.error).toBe("Rate limited");
	});
});

// ── POST /admin/x-shop/listings/create ───────────────────────────────────────

describe("admin POST /x-shop/listings/create", () => {
	it("creates a listing and returns it", async () => {
		const listing = makeListing({ title: "Limited Edition Tee" });
		const ctrl = makeController({
			createListing: vi.fn().mockResolvedValue(listing),
		});
		const result = (await call(createListingHandler, {
			body: { localProductId: "prod_1", title: "Limited Edition Tee" },
			controller: ctrl,
		})) as { listing: Listing };
		expect(result.listing.title).toBe("Limited Edition Tee");
	});
});

// ── PUT /admin/x-shop/listings/:id/update ────────────────────────────────────

describe("admin PUT /x-shop/listings/:id/update", () => {
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

// ── DELETE /admin/x-shop/listings/:id/delete ─────────────────────────────────

describe("admin DELETE /x-shop/listings/:id/delete", () => {
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

// ── GET /admin/x-shop/listings/:id ───────────────────────────────────────────

describe("admin GET /x-shop/listings/:id", () => {
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

// ── GET /admin/x-shop/listings ───────────────────────────────────────────────

describe("admin GET /x-shop/listings", () => {
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

// ── GET /admin/x-shop/orders/:id ─────────────────────────────────────────────

describe("admin GET /x-shop/orders/:id", () => {
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

// ── GET /admin/x-shop/orders ─────────────────────────────────────────────────

describe("admin GET /x-shop/orders", () => {
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

// ── PUT /admin/x-shop/orders/:id/status ──────────────────────────────────────

describe("admin PUT /x-shop/orders/:id/status", () => {
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

// ── POST /admin/x-shop/drops/create ──────────────────────────────────────────

describe("admin POST /x-shop/drops/create", () => {
	it("creates a drop and returns it", async () => {
		const drop = makeProductDrop({ name: "Winter Launch" });
		const ctrl = makeController({
			createDrop: vi.fn().mockResolvedValue(drop),
		});
		const launchDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
		const result = (await call(createDropHandler, {
			body: {
				name: "Winter Launch",
				productIds: ["prod_1", "prod_2"],
				launchDate: launchDate.toISOString(),
			},
			controller: ctrl,
		})) as { drop: ProductDrop };
		expect(result.drop.name).toBe("Winter Launch");
		expect(ctrl.createDrop).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Winter Launch",
				productIds: ["prod_1", "prod_2"],
			}),
		);
	});
});

// ── GET /admin/x-shop/drops/:id ──────────────────────────────────────────────

describe("admin GET /x-shop/drops/:id", () => {
	it("returns error when drop not found", async () => {
		const result = (await call(getDropHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Drop not found");
	});

	it("returns drop when found", async () => {
		const drop = makeProductDrop({ id: "drop_1" });
		const ctrl = makeController({
			getDrop: vi.fn().mockResolvedValue(drop),
		});
		const result = (await call(getDropHandler, {
			params: { id: "drop_1" },
			controller: ctrl,
		})) as { drop: ProductDrop };
		expect(result.drop.id).toBe("drop_1");
	});
});

// ── POST /admin/x-shop/drops/:id/cancel ──────────────────────────────────────

describe("admin POST /x-shop/drops/:id/cancel", () => {
	it("returns error when drop not found", async () => {
		const result = (await call(cancelDropHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Drop not found");
	});

	it("cancels drop and returns it", async () => {
		const drop = makeProductDrop({ id: "drop_1", status: "cancelled" });
		const ctrl = makeController({
			cancelDrop: vi.fn().mockResolvedValue(drop),
		});
		const result = (await call(cancelDropHandler, {
			params: { id: "drop_1" },
			controller: ctrl,
		})) as { drop: ProductDrop };
		expect(result.drop.status).toBe("cancelled");
		expect(ctrl.cancelDrop).toHaveBeenCalledWith("drop_1");
	});
});

// ── GET /admin/x-shop/drops ──────────────────────────────────────────────────

describe("admin GET /x-shop/drops", () => {
	it("returns empty list when no drops", async () => {
		const result = (await call(listDropsHandler)) as {
			drops: ProductDrop[];
			total: number;
		};
		expect(result.drops).toHaveLength(0);
	});

	it("returns drops from controller", async () => {
		const drops = [makeProductDrop(), makeProductDrop({ name: "Spring Drop" })];
		const ctrl = makeController({
			listDrops: vi.fn().mockResolvedValue(drops),
		});
		const result = (await call(listDropsHandler, {
			controller: ctrl,
		})) as { drops: ProductDrop[]; total: number };
		expect(result.drops).toHaveLength(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listDropsHandler, {
			query: { status: "scheduled" },
			controller: ctrl,
		});
		expect(ctrl.listDrops).toHaveBeenCalledWith(
			expect.objectContaining({ status: "scheduled" }),
		);
	});
});

// ── GET /admin/x-shop/drops/:id/stats ────────────────────────────────────────

describe("admin GET /x-shop/drops/:id/stats", () => {
	it("returns error when drop not found", async () => {
		const result = (await call(dropStatsHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Drop not found");
	});

	it("returns drop stats when found", async () => {
		const stats = makeDropStats({ impressions: 500, conversions: 25 });
		const ctrl = makeController({
			getDropStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(dropStatsHandler, {
			params: { id: "drop_1" },
			controller: ctrl,
		})) as { stats: DropStats };
		expect(result.stats.impressions).toBe(500);
		expect(result.stats.conversions).toBe(25);
	});
});

// ── GET /admin/x-shop/stats ──────────────────────────────────────────────────

describe("admin GET /x-shop/stats", () => {
	it("returns channel stats", async () => {
		const stats = makeChannelStats({ totalListings: 5, totalOrders: 3 });
		const ctrl = makeController({
			getChannelStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(statsHandler, {
			controller: ctrl,
		})) as { stats: ChannelStats };
		expect(result.stats.totalListings).toBe(5);
		expect(result.stats.totalOrders).toBe(3);
	});
});
