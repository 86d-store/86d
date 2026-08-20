import { describe, expect, it, vi } from "vitest";
import { createFeedItemEndpoint } from "../admin/endpoints/create-feed-item";
import { deleteFeedItemEndpoint } from "../admin/endpoints/delete-feed-item";
import { diagnosticsEndpoint } from "../admin/endpoints/diagnostics";
import { getFeedItemEndpoint } from "../admin/endpoints/get-feed-item";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { listFeedItemsEndpoint } from "../admin/endpoints/list-feed-items";
import { listOrdersEndpoint } from "../admin/endpoints/list-orders";
import { listSubmissionsEndpoint } from "../admin/endpoints/list-submissions";
import { statsEndpoint } from "../admin/endpoints/stats";
import { submitFeedEndpoint } from "../admin/endpoints/submit-feed";
import { updateFeedItemEndpoint } from "../admin/endpoints/update-feed-item";
import { updateOrderStatusEndpoint } from "../admin/endpoints/update-order-status";
import type {
	ChannelOrder,
	ChannelStats,
	FeedDiagnostics,
	FeedSubmission,
	GoogleShoppingController,
	ProductFeedItem,
} from "../service";

const mockVerifyConnection = vi.hoisted(() =>
	vi.fn().mockResolvedValue({ ok: true, merchantId: "merchant_1" }),
);

vi.mock("../provider", () => ({
	GoogleShoppingProvider: class {
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

function makeFeedItem(
	overrides: Partial<ProductFeedItem> = {},
): ProductFeedItem {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		localProductId: "prod_1",
		title: "Test Widget",
		status: "active",
		disapprovalReasons: [],
		condition: "new",
		availability: "in-stock",
		price: 1999,
		link: "https://example.com/widget",
		imageLink: "https://example.com/widget.jpg",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeOrder(overrides: Partial<ChannelOrder> = {}): ChannelOrder {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		googleOrderId: "google_order_1",
		status: "pending",
		items: [],
		subtotal: 1999,
		shippingCost: 0,
		tax: 160,
		total: 2159,
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
		status: "completed",
		totalProducts: 10,
		approvedProducts: 9,
		disapprovedProducts: 1,
		submittedAt: now,
		createdAt: now,
		...overrides,
	};
}

function makeChannelStats(overrides: Partial<ChannelStats> = {}): ChannelStats {
	return {
		totalFeedItems: 10,
		active: 8,
		pending: 1,
		disapproved: 1,
		expiring: 0,
		totalOrders: 3,
		totalRevenue: 6477,
		...overrides,
	};
}

function makeDiagnostics(
	overrides: Partial<FeedDiagnostics> = {},
): FeedDiagnostics {
	return {
		statusBreakdown: [{ status: "active", count: 8 }],
		disapprovalReasons: [],
		...overrides,
	};
}

function makeController(
	overrides: Partial<GoogleShoppingController> = {},
): GoogleShoppingController {
	return {
		createFeedItem: vi.fn().mockResolvedValue(makeFeedItem()),
		updateFeedItem: vi.fn().mockResolvedValue(null),
		deleteFeedItem: vi.fn().mockResolvedValue(false),
		getFeedItem: vi.fn().mockResolvedValue(null),
		getFeedItemByProduct: vi.fn().mockResolvedValue(null),
		listFeedItems: vi.fn().mockResolvedValue([]),
		submitFeed: vi.fn().mockResolvedValue(makeFeedSubmission()),
		getLastSubmission: vi.fn().mockResolvedValue(null),
		listSubmissions: vi.fn().mockResolvedValue([]),
		receiveOrder: vi.fn().mockResolvedValue(makeOrder()),
		getOrder: vi.fn().mockResolvedValue(null),
		updateOrderStatus: vi.fn().mockResolvedValue(null),
		listOrders: vi.fn().mockResolvedValue([]),
		getChannelStats: vi.fn().mockResolvedValue(makeChannelStats()),
		getDiagnostics: vi.fn().mockResolvedValue(makeDiagnostics()),
		pushProduct: vi.fn().mockResolvedValue(null),
		syncProducts: vi.fn().mockResolvedValue({ synced: 0 }),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: GoogleShoppingController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: {
				"google-shopping": opts.controller ?? makeController(),
			},
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const settingsHandler = extractHandler(
	createGetSettingsEndpoint({
		merchantId: "merchant_1",
		apiKey: "api_key_1",
	}),
);
const settingsEmptyHandler = extractHandler(createGetSettingsEndpoint({}));
const createFeedItemHandler = extractHandler(createFeedItemEndpoint);
const updateFeedItemHandler = extractHandler(updateFeedItemEndpoint);
const deleteFeedItemHandler = extractHandler(deleteFeedItemEndpoint);
const getFeedItemHandler = extractHandler(getFeedItemEndpoint);
const listFeedItemsHandler = extractHandler(listFeedItemsEndpoint);
const submitFeedHandler = extractHandler(submitFeedEndpoint);
const listSubmissionsHandler = extractHandler(listSubmissionsEndpoint);
const listOrdersHandler = extractHandler(listOrdersEndpoint);
const updateOrderStatusHandler = extractHandler(updateOrderStatusEndpoint);
const statsHandler = extractHandler(statsEndpoint);
const diagnosticsHandler = extractHandler(diagnosticsEndpoint);

// ── GET /admin/google-shopping/settings ──────────────────────────────────────

describe("admin GET /google-shopping/settings", () => {
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
			merchantId: "merchant_1",
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
});

// ── POST /admin/google-shopping/feed-items/create ────────────────────────────

describe("admin POST /google-shopping/feed-items/create", () => {
	it("creates a feed item and returns it", async () => {
		const item = makeFeedItem({ title: "Premium Widget" });
		const ctrl = makeController({
			createFeedItem: vi.fn().mockResolvedValue(item),
		});
		const result = (await call(createFeedItemHandler, {
			body: {
				localProductId: "prod_1",
				title: "Premium Widget",
				price: 2999,
				link: "https://example.com/widget",
				imageLink: "https://example.com/widget.jpg",
			},
			controller: ctrl,
		})) as { item: ProductFeedItem };
		expect(result.item.title).toBe("Premium Widget");
	});

	it("forwards all fields to controller", async () => {
		const ctrl = makeController();
		await call(createFeedItemHandler, {
			body: {
				localProductId: "prod_2",
				title: "Another Widget",
				price: 1499,
				link: "https://example.com/a",
				imageLink: "https://example.com/a.jpg",
				condition: "new",
				availability: "in-stock",
				brand: "Acme",
			},
			controller: ctrl,
		});
		expect(ctrl.createFeedItem).toHaveBeenCalledWith(
			expect.objectContaining({ condition: "new", brand: "Acme" }),
		);
	});
});

// ── PUT /admin/google-shopping/feed-items/:id/update ─────────────────────────

describe("admin PUT /google-shopping/feed-items/:id/update", () => {
	it("updates feed item and returns it", async () => {
		const updated = makeFeedItem({ id: "item_1", price: 2499 });
		const ctrl = makeController({
			updateFeedItem: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateFeedItemHandler, {
			params: { id: "item_1" },
			body: { price: 2499 },
			controller: ctrl,
		})) as { item: ProductFeedItem };
		expect(result.item.price).toBe(2499);
		expect(ctrl.updateFeedItem).toHaveBeenCalledWith(
			"item_1",
			expect.objectContaining({ price: 2499 }),
		);
	});

	it("returns null item when not found", async () => {
		const result = (await call(updateFeedItemHandler, {
			params: { id: "missing" },
			body: {},
		})) as { item: null };
		expect(result.item).toBeNull();
	});
});

// ── DELETE /admin/google-shopping/feed-items/:id/delete ──────────────────────

describe("admin DELETE /google-shopping/feed-items/:id/delete", () => {
	it("returns deleted: false when not found", async () => {
		const result = (await call(deleteFeedItemHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("returns deleted: true when deleted", async () => {
		const ctrl = makeController({
			deleteFeedItem: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteFeedItemHandler, {
			params: { id: "item_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

// ── GET /admin/google-shopping/feed-items/:id ────────────────────────────────

describe("admin GET /google-shopping/feed-items/:id", () => {
	it("returns null when not found", async () => {
		const result = (await call(getFeedItemHandler, {
			params: { id: "missing" },
		})) as { item: null };
		expect(result.item).toBeNull();
	});

	it("returns item when found", async () => {
		const item = makeFeedItem({ id: "item_1" });
		const ctrl = makeController({
			getFeedItem: vi.fn().mockResolvedValue(item),
		});
		const result = (await call(getFeedItemHandler, {
			params: { id: "item_1" },
			controller: ctrl,
		})) as { item: ProductFeedItem };
		expect(result.item.id).toBe("item_1");
	});
});

// ── GET /admin/google-shopping/feed-items ────────────────────────────────────

describe("admin GET /google-shopping/feed-items", () => {
	it("returns empty list when no items", async () => {
		const result = (await call(listFeedItemsHandler)) as {
			items: ProductFeedItem[];
			total: number;
		};
		expect(result.items).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns items from controller", async () => {
		const items = [makeFeedItem(), makeFeedItem()];
		const ctrl = makeController({
			listFeedItems: vi.fn().mockResolvedValue(items),
		});
		const result = (await call(listFeedItemsHandler, {
			controller: ctrl,
		})) as { items: ProductFeedItem[]; total: number };
		expect(result.items).toHaveLength(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listFeedItemsHandler, {
			query: { status: "active" },
			controller: ctrl,
		});
		expect(ctrl.listFeedItems).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" }),
		);
	});
});

// ── POST /admin/google-shopping/submit ───────────────────────────────────────

describe("admin POST /google-shopping/submit", () => {
	it("submits feed and returns submission record", async () => {
		const submission = makeFeedSubmission({
			approvedProducts: 10,
			disapprovedProducts: 0,
		});
		const ctrl = makeController({
			submitFeed: vi.fn().mockResolvedValue(submission),
		});
		const result = (await call(submitFeedHandler, {
			controller: ctrl,
		})) as { submission: FeedSubmission };
		expect(result.submission.approvedProducts).toBe(10);
	});
});

// ── GET /admin/google-shopping/submissions ───────────────────────────────────

describe("admin GET /google-shopping/submissions", () => {
	it("returns empty list when no submissions", async () => {
		const result = (await call(listSubmissionsHandler)) as {
			submissions: FeedSubmission[];
			total: number;
		};
		expect(result.submissions).toHaveLength(0);
	});

	it("returns submissions from controller", async () => {
		const submissions = [makeFeedSubmission(), makeFeedSubmission()];
		const ctrl = makeController({
			listSubmissions: vi.fn().mockResolvedValue(submissions),
		});
		const result = (await call(listSubmissionsHandler, {
			controller: ctrl,
		})) as { submissions: FeedSubmission[]; total: number };
		expect(result.submissions).toHaveLength(2);
	});
});

// ── GET /admin/google-shopping/orders ────────────────────────────────────────

describe("admin GET /google-shopping/orders", () => {
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

// ── PUT /admin/google-shopping/orders/:id/status ─────────────────────────────

describe("admin PUT /google-shopping/orders/:id/status", () => {
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
		expect(ctrl.updateOrderStatus).toHaveBeenCalledWith(
			"ord_1",
			"shipped",
			undefined,
			undefined,
		);
	});

	it("returns null order when not found", async () => {
		const result = (await call(updateOrderStatusHandler, {
			params: { id: "missing" },
			body: { status: "shipped" },
		})) as { order: null };
		expect(result.order).toBeNull();
	});
});

// ── GET /admin/google-shopping/stats ─────────────────────────────────────────

describe("admin GET /google-shopping/stats", () => {
	it("returns channel stats", async () => {
		const stats = makeChannelStats({ totalFeedItems: 10, active: 8 });
		const ctrl = makeController({
			getChannelStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(statsHandler, {
			controller: ctrl,
		})) as { stats: ChannelStats };
		expect(result.stats.totalFeedItems).toBe(10);
		expect(result.stats.active).toBe(8);
	});
});

// ── GET /admin/google-shopping/diagnostics ───────────────────────────────────

describe("admin GET /google-shopping/diagnostics", () => {
	it("returns feed diagnostics", async () => {
		const diagnostics = makeDiagnostics({
			disapprovalReasons: [{ reason: "invalid-image", count: 1 }],
		});
		const ctrl = makeController({
			getDiagnostics: vi.fn().mockResolvedValue(diagnostics),
		});
		const result = (await call(diagnosticsHandler, {
			controller: ctrl,
		})) as { diagnostics: FeedDiagnostics };
		expect(result.diagnostics.disapprovalReasons).toHaveLength(1);
	});
});
