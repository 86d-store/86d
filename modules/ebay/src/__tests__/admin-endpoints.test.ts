import { describe, expect, it, vi } from "vitest";
import { activeAuctionsEndpoint } from "../admin/endpoints/active-auctions";
import { createListingEndpoint } from "../admin/endpoints/create-listing";
import { endListingEndpoint } from "../admin/endpoints/end-listing";
import { getListingEndpoint } from "../admin/endpoints/get-listing";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { listListingsEndpoint } from "../admin/endpoints/list-listings";
import { listOrdersEndpoint } from "../admin/endpoints/list-orders";
import { shipOrderEndpoint } from "../admin/endpoints/ship-order";
import { statsEndpoint } from "../admin/endpoints/stats";
import { syncOrdersEndpoint } from "../admin/endpoints/sync-orders";
import { updateListingEndpoint } from "../admin/endpoints/update-listing";
import type {
	ChannelStats,
	EbayController,
	EbayListing,
	EbayOrder,
} from "../service";

const mockVerifyConnection = vi.hoisted(() =>
	vi.fn().mockResolvedValue({ ok: true, mode: "sandbox", scopes: [] }),
);

vi.mock("../provider", () => ({
	EbayProvider: class {
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

function makeListing(overrides: Partial<EbayListing> = {}): EbayListing {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		localProductId: "prod_1",
		title: "Vintage Camera",
		status: "active",
		listingType: "fixed-price",
		price: 7999,
		bidCount: 0,
		quantity: 1,
		condition: "very-good",
		watchers: 0,
		views: 0,
		metadata: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeOrder(overrides: Partial<EbayOrder> = {}): EbayOrder {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		ebayOrderId: "ebay_order_1",
		status: "pending",
		items: [],
		subtotal: 7999,
		shippingCost: 500,
		ebayFee: 800,
		paymentProcessingFee: 300,
		total: 9599,
		shippingAddress: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeChannelStats(overrides: Partial<ChannelStats> = {}): ChannelStats {
	return {
		totalListings: 5,
		activeListings: 4,
		totalOrders: 3,
		totalRevenue: 28797,
		activeAuctions: 1,
		averagePrice: 7999,
		...overrides,
	};
}

function makeController(
	overrides: Partial<EbayController> = {},
): EbayController {
	return {
		createListing: vi.fn().mockResolvedValue(makeListing()),
		updateListing: vi.fn().mockResolvedValue(null),
		endListing: vi.fn().mockResolvedValue(null),
		getListing: vi.fn().mockResolvedValue(null),
		getListingByProduct: vi.fn().mockResolvedValue(null),
		listListings: vi.fn().mockResolvedValue([]),
		receiveOrder: vi.fn().mockResolvedValue(makeOrder()),
		getOrder: vi.fn().mockResolvedValue(null),
		shipOrder: vi.fn().mockResolvedValue(null),
		listOrders: vi.fn().mockResolvedValue([]),
		syncOrders: vi.fn().mockResolvedValue([]),
		getChannelStats: vi.fn().mockResolvedValue(makeChannelStats()),
		getActiveAuctions: vi.fn().mockResolvedValue([]),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: EbayController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { ebay: opts.controller ?? makeController() } },
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const settingsHandler = extractHandler(
	createGetSettingsEndpoint({
		clientId: "CLIENT_ID_1",
		clientSecret: "CLIENT_SECRET_1",
		refreshToken: "REFRESH_TOKEN_1",
		sandbox: true,
	}),
);
const settingsEmptyHandler = extractHandler(createGetSettingsEndpoint({}));
const createListingHandler = extractHandler(createListingEndpoint);
const updateListingHandler = extractHandler(updateListingEndpoint);
const endListingHandler = extractHandler(endListingEndpoint);
const getListingHandler = extractHandler(getListingEndpoint);
const listListingsHandler = extractHandler(listListingsEndpoint);
const shipOrderHandler = extractHandler(shipOrderEndpoint);
const listOrdersHandler = extractHandler(listOrdersEndpoint);
const syncOrdersHandler = extractHandler(syncOrdersEndpoint);
const statsHandler = extractHandler(statsEndpoint);
const activeAuctionsHandler = extractHandler(activeAuctionsEndpoint);

// ── GET /admin/ebay/settings ──────────────────────────────────────────────────

describe("admin GET /ebay/settings", () => {
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
			scopes: [],
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
			error: "Invalid client credentials",
		});
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { status: string; error: string };
		expect(result.status).toBe("error");
		expect(result.error).toBe("Invalid client credentials");
	});

	it("reports missing scopes when required scopes absent", async () => {
		mockVerifyConnection.mockResolvedValueOnce({
			ok: true,
			mode: "live",
			scopes: [],
		});
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { missingScopes: string[] };
		expect(result.missingScopes.length).toBeGreaterThan(0);
	});
});

// ── POST /admin/ebay/listings/create ─────────────────────────────────────────

describe("admin POST /ebay/listings/create", () => {
	it("creates a listing and returns it", async () => {
		const listing = makeListing({ title: "Old Film Camera" });
		const ctrl = makeController({
			createListing: vi.fn().mockResolvedValue(listing),
		});
		const result = (await call(createListingHandler, {
			body: {
				localProductId: "prod_1",
				title: "Old Film Camera",
				price: 9999,
			},
			controller: ctrl,
		})) as { listing: EbayListing };
		expect(result.listing.title).toBe("Old Film Camera");
	});

	it("forwards listing type and condition to controller", async () => {
		const ctrl = makeController();
		await call(createListingHandler, {
			body: {
				localProductId: "prod_2",
				title: "Vintage Lens",
				price: 4999,
				listingType: "auction",
				condition: "good",
				auctionStartPrice: 999,
			},
			controller: ctrl,
		});
		expect(ctrl.createListing).toHaveBeenCalledWith(
			expect.objectContaining({
				listingType: "auction",
				condition: "good",
				auctionStartPrice: 999,
			}),
		);
	});
});

// ── PUT /admin/ebay/listings/:id/update ──────────────────────────────────────

describe("admin PUT /ebay/listings/:id/update", () => {
	it("updates listing and returns it", async () => {
		const updated = makeListing({ id: "lst_1", price: 8999 });
		const ctrl = makeController({
			updateListing: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateListingHandler, {
			params: { id: "lst_1" },
			body: { price: 8999 },
			controller: ctrl,
		})) as { listing: EbayListing };
		expect(result.listing.price).toBe(8999);
	});

	it("returns null listing when not found", async () => {
		const result = (await call(updateListingHandler, {
			params: { id: "missing" },
			body: {},
		})) as { listing: null };
		expect(result.listing).toBeNull();
	});
});

// ── PUT /admin/ebay/listings/:id/end ─────────────────────────────────────────

describe("admin PUT /ebay/listings/:id/end", () => {
	it("ends listing and returns it", async () => {
		const listing = makeListing({ id: "lst_1", status: "ended" });
		const ctrl = makeController({
			endListing: vi.fn().mockResolvedValue(listing),
		});
		const result = (await call(endListingHandler, {
			params: { id: "lst_1" },
			controller: ctrl,
		})) as { listing: EbayListing };
		expect(result.listing.status).toBe("ended");
		expect(ctrl.endListing).toHaveBeenCalledWith("lst_1");
	});

	it("returns null listing when not found", async () => {
		const result = (await call(endListingHandler, {
			params: { id: "missing" },
		})) as { listing: null };
		expect(result.listing).toBeNull();
	});
});

// ── GET /admin/ebay/listings/:id ─────────────────────────────────────────────

describe("admin GET /ebay/listings/:id", () => {
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
		})) as { listing: EbayListing };
		expect(result.listing.id).toBe("lst_1");
	});
});

// ── GET /admin/ebay/listings ──────────────────────────────────────────────────

describe("admin GET /ebay/listings", () => {
	it("returns empty list when no listings", async () => {
		const result = (await call(listListingsHandler)) as {
			listings: EbayListing[];
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
		})) as { listings: EbayListing[]; total: number };
		expect(result.listings).toHaveLength(2);
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

// ── PUT /admin/ebay/orders/:id/ship ──────────────────────────────────────────

describe("admin PUT /ebay/orders/:id/ship", () => {
	it("ships order and returns it", async () => {
		const order = makeOrder({ id: "ord_1", status: "shipped" });
		const ctrl = makeController({
			shipOrder: vi.fn().mockResolvedValue(order),
		});
		const result = (await call(shipOrderHandler, {
			params: { id: "ord_1" },
			body: { trackingNumber: "1Z999", carrier: "UPS" },
			controller: ctrl,
		})) as { order: EbayOrder };
		expect(result.order.status).toBe("shipped");
		expect(ctrl.shipOrder).toHaveBeenCalledWith("ord_1", "1Z999", "UPS");
	});
});

// ── GET /admin/ebay/orders ────────────────────────────────────────────────────

describe("admin GET /ebay/orders", () => {
	it("returns empty list when no orders", async () => {
		const result = (await call(listOrdersHandler)) as {
			orders: EbayOrder[];
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
		})) as { orders: EbayOrder[]; total: number };
		expect(result.orders).toHaveLength(2);
	});
});

// ── POST /admin/ebay/orders/sync ─────────────────────────────────────────────

describe("admin POST /ebay/orders/sync", () => {
	it("syncs orders and returns count", async () => {
		const orders = [makeOrder(), makeOrder(), makeOrder()];
		const ctrl = makeController({
			syncOrders: vi.fn().mockResolvedValue(orders),
		});
		const result = (await call(syncOrdersHandler, {
			controller: ctrl,
		})) as { synced: number };
		expect(result.synced).toBe(3);
	});
});

// ── GET /admin/ebay/stats ─────────────────────────────────────────────────────

describe("admin GET /ebay/stats", () => {
	it("returns channel stats", async () => {
		const stats = makeChannelStats({ totalListings: 5, activeAuctions: 2 });
		const ctrl = makeController({
			getChannelStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(statsHandler, {
			controller: ctrl,
		})) as { stats: ChannelStats };
		expect(result.stats.totalListings).toBe(5);
		expect(result.stats.activeAuctions).toBe(2);
	});
});

// ── GET /admin/ebay/auctions ──────────────────────────────────────────────────

describe("admin GET /ebay/auctions", () => {
	it("returns empty list when no active auctions", async () => {
		const result = (await call(activeAuctionsHandler)) as {
			auctions: EbayListing[];
		};
		expect(result.auctions).toHaveLength(0);
	});

	it("returns active auctions from controller", async () => {
		const auctions = [
			makeListing({ listingType: "auction", status: "active" }),
		];
		const ctrl = makeController({
			getActiveAuctions: vi.fn().mockResolvedValue(auctions),
		});
		const result = (await call(activeAuctionsHandler, {
			controller: ctrl,
		})) as { auctions: EbayListing[] };
		expect(result.auctions).toHaveLength(1);
		expect(result.auctions[0].listingType).toBe("auction");
	});
});
