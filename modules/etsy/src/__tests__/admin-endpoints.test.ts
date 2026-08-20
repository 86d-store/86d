import { describe, expect, it, vi } from "vitest";
import { averageRatingEndpoint } from "../admin/endpoints/average-rating";
import { createListingEndpoint } from "../admin/endpoints/create-listing";
import { deleteListingEndpoint } from "../admin/endpoints/delete-listing";
import { expiringListingsEndpoint } from "../admin/endpoints/expiring-listings";
import { getListingEndpoint } from "../admin/endpoints/get-listing";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { listListingsEndpoint } from "../admin/endpoints/list-listings";
import { listOrdersEndpoint } from "../admin/endpoints/list-orders";
import { listReviewsEndpoint } from "../admin/endpoints/list-reviews";
import { renewListingEndpoint } from "../admin/endpoints/renew-listing";
import { shipOrderEndpoint } from "../admin/endpoints/ship-order";
import { statsEndpoint } from "../admin/endpoints/stats";
import { updateListingEndpoint } from "../admin/endpoints/update-listing";
import type {
	ChannelStats,
	EtsyController,
	EtsyListing,
	EtsyOrder,
	EtsyReview,
} from "../service";

const mockVerifyConnection = vi.hoisted(() =>
	vi.fn().mockResolvedValue({ ok: true, shopId: "shop_1" }),
);

vi.mock("../provider", () => ({
	EtsyProvider: class {
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

function makeListing(overrides: Partial<EtsyListing> = {}): EtsyListing {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		localProductId: "prod_1",
		title: "Handmade Mug",
		status: "active",
		state: "active",
		price: 2500,
		quantity: 5,
		whoMadeIt: "i-did",
		whenMadeIt: "2020_2024",
		isSupply: false,
		materials: [],
		tags: [],
		views: 0,
		favorites: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeOrder(overrides: Partial<EtsyOrder> = {}): EtsyOrder {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		etsyReceiptId: "receipt_1",
		status: "open",
		items: [],
		subtotal: 2500,
		shippingCost: 500,
		etsyFee: 200,
		processingFee: 75,
		tax: 0,
		total: 3275,
		shippingAddress: { city: "Portland" },
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeReview(overrides: Partial<EtsyReview> = {}): EtsyReview {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		etsyTransactionId: "txn_1",
		rating: 5,
		buyerName: "Alice",
		createdAt: now,
		...overrides,
	};
}

function makeChannelStats(overrides: Partial<ChannelStats> = {}): ChannelStats {
	return {
		totalListings: 10,
		active: 8,
		draft: 1,
		expired: 0,
		inactive: 1,
		soldOut: 0,
		totalOrders: 5,
		totalRevenue: 16375,
		totalViews: 100,
		totalFavorites: 20,
		averageRating: 4.8,
		totalReviews: 3,
		...overrides,
	};
}

function makeController(
	overrides: Partial<EtsyController> = {},
): EtsyController {
	return {
		createListing: vi.fn().mockResolvedValue(makeListing()),
		updateListing: vi.fn().mockResolvedValue(null),
		deleteListing: vi.fn().mockResolvedValue(false),
		getListing: vi.fn().mockResolvedValue(null),
		getListingByProduct: vi.fn().mockResolvedValue(null),
		listListings: vi.fn().mockResolvedValue([]),
		renewListing: vi.fn().mockResolvedValue(null),
		receiveOrder: vi.fn().mockResolvedValue(makeOrder()),
		getOrder: vi.fn().mockResolvedValue(null),
		shipOrder: vi.fn().mockResolvedValue(null),
		listOrders: vi.fn().mockResolvedValue([]),
		receiveReview: vi.fn().mockResolvedValue(makeReview()),
		listReviews: vi.fn().mockResolvedValue([]),
		getAverageRating: vi.fn().mockResolvedValue(0),
		getChannelStats: vi.fn().mockResolvedValue(makeChannelStats()),
		getExpiringListings: vi.fn().mockResolvedValue([]),
		pushListing: vi.fn().mockResolvedValue(null),
		syncListings: vi.fn().mockResolvedValue({ synced: 0 }),
		syncOrders: vi.fn().mockResolvedValue({ synced: 0 }),
		syncReviews: vi.fn().mockResolvedValue({ synced: 0 }),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: EtsyController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { etsy: opts.controller ?? makeController() } },
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const settingsHandler = extractHandler(
	createGetSettingsEndpoint({
		apiKey: "apikey_123",
		shopId: "shop_1",
		accessToken: "token_1",
	}),
);
const settingsEmptyHandler = extractHandler(createGetSettingsEndpoint({}));
const createListingHandler = extractHandler(createListingEndpoint);
const updateListingHandler = extractHandler(updateListingEndpoint);
const deleteListingHandler = extractHandler(deleteListingEndpoint);
const getListingHandler = extractHandler(getListingEndpoint);
const listListingsHandler = extractHandler(listListingsEndpoint);
const renewListingHandler = extractHandler(renewListingEndpoint);
const shipOrderHandler = extractHandler(shipOrderEndpoint);
const listOrdersHandler = extractHandler(listOrdersEndpoint);
const listReviewsHandler = extractHandler(listReviewsEndpoint);
const averageRatingHandler = extractHandler(averageRatingEndpoint);
const expiringListingsHandler = extractHandler(expiringListingsEndpoint);
const statsHandler = extractHandler(statsEndpoint);

// ── GET /admin/etsy/settings ──────────────────────────────────────────────────

describe("admin GET /etsy/settings", () => {
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
		mockVerifyConnection.mockResolvedValueOnce({ ok: true, shopId: "shop_1" });
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
			error: "Invalid API key",
		});
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { status: string; error: string };
		expect(result.status).toBe("error");
		expect(result.error).toBe("Invalid API key");
	});

	it("masks apiKey in response", async () => {
		mockVerifyConnection.mockResolvedValueOnce({ ok: true, shopId: "shop_1" });
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { apiKey: string };
		expect(result.apiKey).toMatch(/\.\.\./);
	});
});

// ── POST /admin/etsy/listings/create ─────────────────────────────────────────

describe("admin POST /etsy/listings/create", () => {
	it("creates a listing and returns it", async () => {
		const listing = makeListing({ title: "Ceramic Bowl" });
		const ctrl = makeController({
			createListing: vi.fn().mockResolvedValue(listing),
		});
		const result = (await call(createListingHandler, {
			body: { localProductId: "prod_1", title: "Ceramic Bowl", price: 3500 },
			controller: ctrl,
		})) as { listing: EtsyListing };
		expect(result.listing.title).toBe("Ceramic Bowl");
	});

	it("forwards all fields to controller", async () => {
		const ctrl = makeController();
		await call(createListingHandler, {
			body: {
				localProductId: "prod_2",
				title: "Pottery Vase",
				price: 4500,
				whoMadeIt: "i-did",
				isSupply: false,
				materials: ["clay"],
				tags: ["pottery"],
			},
			controller: ctrl,
		});
		expect(ctrl.createListing).toHaveBeenCalledWith(
			expect.objectContaining({
				whoMadeIt: "i-did",
				materials: ["clay"],
				tags: ["pottery"],
			}),
		);
	});
});

// ── PUT /admin/etsy/listings/:id/update ──────────────────────────────────────

describe("admin PUT /etsy/listings/:id/update", () => {
	it("updates listing and returns it", async () => {
		const updated = makeListing({ id: "lst_1", price: 5000 });
		const ctrl = makeController({
			updateListing: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateListingHandler, {
			params: { id: "lst_1" },
			body: { price: 5000 },
			controller: ctrl,
		})) as { listing: EtsyListing };
		expect(result.listing.price).toBe(5000);
		expect(ctrl.updateListing).toHaveBeenCalledWith(
			"lst_1",
			expect.objectContaining({ price: 5000 }),
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

// ── DELETE /admin/etsy/listings/:id/delete ───────────────────────────────────

describe("admin DELETE /etsy/listings/:id/delete", () => {
	it("returns deleted: false when not found", async () => {
		const result = (await call(deleteListingHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("deletes listing and returns deleted: true", async () => {
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

// ── GET /admin/etsy/listings/:id ─────────────────────────────────────────────

describe("admin GET /etsy/listings/:id", () => {
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
		})) as { listing: EtsyListing };
		expect(result.listing.id).toBe("lst_1");
	});
});

// ── GET /admin/etsy/listings ──────────────────────────────────────────────────

describe("admin GET /etsy/listings", () => {
	it("returns empty list when no listings", async () => {
		const result = (await call(listListingsHandler)) as {
			listings: EtsyListing[];
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
		})) as { listings: EtsyListing[]; total: number };
		expect(result.listings).toHaveLength(2);
	});

	it("forwards status filter", async () => {
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

// ── POST /admin/etsy/listings/:id/renew ──────────────────────────────────────

describe("admin POST /etsy/listings/:id/renew", () => {
	it("renews listing and returns it", async () => {
		const listing = makeListing({ id: "lst_1" });
		const ctrl = makeController({
			renewListing: vi.fn().mockResolvedValue(listing),
		});
		const result = (await call(renewListingHandler, {
			params: { id: "lst_1" },
			controller: ctrl,
		})) as { listing: EtsyListing };
		expect(result.listing.id).toBe("lst_1");
		expect(ctrl.renewListing).toHaveBeenCalledWith("lst_1");
	});

	it("returns null listing when not found", async () => {
		const result = (await call(renewListingHandler, {
			params: { id: "missing" },
		})) as { listing: null };
		expect(result.listing).toBeNull();
	});
});

// ── PUT /admin/etsy/orders/:id/ship ──────────────────────────────────────────

describe("admin PUT /etsy/orders/:id/ship", () => {
	it("ships order and returns it", async () => {
		const order = makeOrder({ id: "ord_1", status: "shipped" });
		const ctrl = makeController({
			shipOrder: vi.fn().mockResolvedValue(order),
		});
		const result = (await call(shipOrderHandler, {
			params: { id: "ord_1" },
			body: { trackingNumber: "1Z999", carrier: "UPS" },
			controller: ctrl,
		})) as { order: EtsyOrder };
		expect(result.order.status).toBe("shipped");
		expect(ctrl.shipOrder).toHaveBeenCalledWith("ord_1", "1Z999", "UPS");
	});
});

// ── GET /admin/etsy/orders ────────────────────────────────────────────────────

describe("admin GET /etsy/orders", () => {
	it("returns empty list when no orders", async () => {
		const result = (await call(listOrdersHandler)) as {
			orders: EtsyOrder[];
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
		})) as { orders: EtsyOrder[]; total: number };
		expect(result.orders).toHaveLength(2);
	});
});

// ── GET /admin/etsy/reviews ───────────────────────────────────────────────────

describe("admin GET /etsy/reviews", () => {
	it("returns empty list when no reviews", async () => {
		const result = (await call(listReviewsHandler)) as {
			reviews: EtsyReview[];
			total: number;
		};
		expect(result.reviews).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns reviews from controller", async () => {
		const reviews = [makeReview({ rating: 5 }), makeReview({ rating: 4 })];
		const ctrl = makeController({
			listReviews: vi.fn().mockResolvedValue(reviews),
		});
		const result = (await call(listReviewsHandler, {
			controller: ctrl,
		})) as { reviews: EtsyReview[]; total: number };
		expect(result.reviews).toHaveLength(2);
	});
});

// ── GET /admin/etsy/reviews/average ──────────────────────────────────────────

describe("admin GET /etsy/reviews/average", () => {
	it("returns average rating of 0 when no reviews", async () => {
		const result = (await call(averageRatingHandler)) as {
			averageRating: number;
		};
		expect(result.averageRating).toBe(0);
	});

	it("returns average rating from controller", async () => {
		const ctrl = makeController({
			getAverageRating: vi.fn().mockResolvedValue(4.7),
		});
		const result = (await call(averageRatingHandler, {
			controller: ctrl,
		})) as { averageRating: number };
		expect(result.averageRating).toBe(4.7);
	});
});

// ── GET /admin/etsy/listings/expiring ────────────────────────────────────────

describe("admin GET /etsy/listings/expiring", () => {
	it("returns empty list when no expiring listings", async () => {
		const result = (await call(expiringListingsHandler)) as {
			listings: EtsyListing[];
			total: number;
		};
		expect(result.listings).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards days parameter to controller", async () => {
		const ctrl = makeController();
		await call(expiringListingsHandler, {
			query: { days: "14" },
			controller: ctrl,
		});
		expect(ctrl.getExpiringListings).toHaveBeenCalledWith(14);
	});

	it("uses 30 day default when days not specified", async () => {
		const ctrl = makeController();
		await call(expiringListingsHandler, { controller: ctrl });
		expect(ctrl.getExpiringListings).toHaveBeenCalledWith(30);
	});
});

// ── GET /admin/etsy/stats ─────────────────────────────────────────────────────

describe("admin GET /etsy/stats", () => {
	it("returns channel stats", async () => {
		const stats = makeChannelStats({ totalListings: 10, active: 8 });
		const ctrl = makeController({
			getChannelStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(statsHandler, {
			controller: ctrl,
		})) as { stats: ChannelStats };
		expect(result.stats.totalListings).toBe(10);
		expect(result.stats.active).toBe(8);
	});
});
