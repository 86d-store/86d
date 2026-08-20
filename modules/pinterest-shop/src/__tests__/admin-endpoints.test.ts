import { describe, expect, it, vi } from "vitest";
import { createCatalogItemEndpoint } from "../admin/endpoints/create-catalog-item";
import { createPinEndpoint } from "../admin/endpoints/create-pin";
import { deleteCatalogItemEndpoint } from "../admin/endpoints/delete-catalog-item";
import { getCatalogItemEndpoint } from "../admin/endpoints/get-catalog-item";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { listCatalogItemsEndpoint } from "../admin/endpoints/list-catalog-items";
import { listPinsEndpoint } from "../admin/endpoints/list-pins";
import { listSyncsEndpoint } from "../admin/endpoints/list-syncs";
import { statsEndpoint } from "../admin/endpoints/stats";
import { syncCatalogEndpoint } from "../admin/endpoints/sync-catalog";
import { updateCatalogItemEndpoint } from "../admin/endpoints/update-catalog-item";
import type {
	CatalogItem,
	CatalogSync,
	ChannelStats,
	PinterestShopController,
	ShoppingPin,
} from "../service";

const mockVerifyConnection = vi.hoisted(() =>
	vi.fn().mockResolvedValue({
		ok: true,
		username: "myshop",
		accountType: "BUSINESS",
	}),
);

vi.mock("../provider", () => ({
	PinterestApiProvider: class {
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

function makeCatalogItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		localProductId: "prod_1",
		title: "Handcrafted Bowl",
		status: "active",
		link: "https://example.com/bowl",
		imageUrl: "https://example.com/bowl.jpg",
		price: 3500,
		availability: "in-stock",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makePin(overrides: Partial<ShoppingPin> = {}): ShoppingPin {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		catalogItemId: "item_1",
		title: "Bowl Pin",
		link: "https://example.com/bowl",
		imageUrl: "https://example.com/bowl.jpg",
		impressions: 0,
		saves: 0,
		clicks: 0,
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
		totalItems: 10,
		syncedItems: 10,
		failedItems: 0,
		startedAt: now,
		createdAt: now,
		...overrides,
	};
}

function makeChannelStats(overrides: Partial<ChannelStats> = {}): ChannelStats {
	return {
		totalCatalogItems: 10,
		activeCatalogItems: 8,
		totalPins: 15,
		totalImpressions: 500,
		totalClicks: 50,
		totalSaves: 30,
		...overrides,
	};
}

function makeController(
	overrides: Partial<PinterestShopController> = {},
): PinterestShopController {
	return {
		createCatalogItem: vi.fn().mockResolvedValue(makeCatalogItem()),
		updateCatalogItem: vi.fn().mockResolvedValue(null),
		deleteCatalogItem: vi.fn().mockResolvedValue(false),
		getCatalogItem: vi.fn().mockResolvedValue(null),
		getCatalogItemByProduct: vi.fn().mockResolvedValue(null),
		listCatalogItems: vi.fn().mockResolvedValue([]),
		syncCatalog: vi.fn().mockResolvedValue(makeCatalogSync()),
		getLastSync: vi.fn().mockResolvedValue(null),
		listSyncs: vi.fn().mockResolvedValue([]),
		createPin: vi.fn().mockResolvedValue(makePin()),
		getPin: vi.fn().mockResolvedValue(null),
		listPins: vi.fn().mockResolvedValue([]),
		getPinAnalytics: vi.fn().mockResolvedValue(null),
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
		controller?: PinterestShopController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: {
				pinterestShop: opts.controller ?? makeController(),
			},
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const settingsHandler = extractHandler(
	createGetSettingsEndpoint({ accessToken: "token_1" }),
);
const settingsEmptyHandler = extractHandler(createGetSettingsEndpoint({}));
const createCatalogItemHandler = extractHandler(createCatalogItemEndpoint);
const updateCatalogItemHandler = extractHandler(updateCatalogItemEndpoint);
const deleteCatalogItemHandler = extractHandler(deleteCatalogItemEndpoint);
const getCatalogItemHandler = extractHandler(getCatalogItemEndpoint);
const listCatalogItemsHandler = extractHandler(listCatalogItemsEndpoint);
const syncCatalogHandler = extractHandler(syncCatalogEndpoint);
const listSyncsHandler = extractHandler(listSyncsEndpoint);
const createPinHandler = extractHandler(createPinEndpoint);
const listPinsHandler = extractHandler(listPinsEndpoint);
const statsHandler = extractHandler(statsEndpoint);

// ── GET /admin/pinterest-shop/settings ───────────────────────────────────────

describe("admin GET /pinterest-shop/settings", () => {
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
			username: "myshop",
			accountType: "BUSINESS",
		});
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as {
			status: string;
			configured: boolean;
			username: string;
			accountType: string;
		};
		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
		expect(result.username).toBe("myshop");
		expect(result.accountType).toBe("BUSINESS");
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

// ── POST /admin/pinterest-shop/items/create ──────────────────────────────────

describe("admin POST /pinterest-shop/items/create", () => {
	it("creates a catalog item and returns it", async () => {
		const item = makeCatalogItem({ title: "Pottery Vase" });
		const ctrl = makeController({
			createCatalogItem: vi.fn().mockResolvedValue(item),
		});
		const result = (await call(createCatalogItemHandler, {
			body: {
				localProductId: "prod_1",
				title: "Pottery Vase",
				link: "https://example.com/vase",
				imageUrl: "https://example.com/vase.jpg",
				price: 4500,
			},
			controller: ctrl,
		})) as { item: CatalogItem };
		expect(result.item.title).toBe("Pottery Vase");
	});

	it("forwards optional fields to controller", async () => {
		const ctrl = makeController();
		await call(createCatalogItemHandler, {
			body: {
				localProductId: "prod_2",
				title: "Mug",
				link: "https://example.com/mug",
				imageUrl: "https://example.com/mug.jpg",
				price: 2500,
				salePrice: 1999,
				availability: "in-stock",
			},
			controller: ctrl,
		});
		expect(ctrl.createCatalogItem).toHaveBeenCalledWith(
			expect.objectContaining({
				salePrice: 1999,
				availability: "in-stock",
			}),
		);
	});
});

// ── PUT /admin/pinterest-shop/items/:id/update ───────────────────────────────

describe("admin PUT /pinterest-shop/items/:id/update", () => {
	it("updates catalog item and returns it", async () => {
		const updated = makeCatalogItem({ id: "item_1", price: 4000 });
		const ctrl = makeController({
			updateCatalogItem: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateCatalogItemHandler, {
			params: { id: "item_1" },
			body: { price: 4000 },
			controller: ctrl,
		})) as { item: CatalogItem };
		expect(result.item.price).toBe(4000);
		expect(ctrl.updateCatalogItem).toHaveBeenCalledWith(
			"item_1",
			expect.objectContaining({ price: 4000 }),
		);
	});

	it("returns null item when not found", async () => {
		const result = (await call(updateCatalogItemHandler, {
			params: { id: "missing" },
			body: {},
		})) as { item: null };
		expect(result.item).toBeNull();
	});
});

// ── DELETE /admin/pinterest-shop/items/:id/delete ────────────────────────────

describe("admin DELETE /pinterest-shop/items/:id/delete", () => {
	it("returns deleted: false when not found", async () => {
		const result = (await call(deleteCatalogItemHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("returns deleted: true when deleted", async () => {
		const ctrl = makeController({
			deleteCatalogItem: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteCatalogItemHandler, {
			params: { id: "item_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

// ── GET /admin/pinterest-shop/items/:id ──────────────────────────────────────

describe("admin GET /pinterest-shop/items/:id", () => {
	it("returns null when not found", async () => {
		const result = (await call(getCatalogItemHandler, {
			params: { id: "missing" },
		})) as { item: null };
		expect(result.item).toBeNull();
	});

	it("returns item when found", async () => {
		const item = makeCatalogItem({ id: "item_1" });
		const ctrl = makeController({
			getCatalogItem: vi.fn().mockResolvedValue(item),
		});
		const result = (await call(getCatalogItemHandler, {
			params: { id: "item_1" },
			controller: ctrl,
		})) as { item: CatalogItem };
		expect(result.item.id).toBe("item_1");
	});
});

// ── GET /admin/pinterest-shop/items ──────────────────────────────────────────

describe("admin GET /pinterest-shop/items", () => {
	it("returns empty list when no items", async () => {
		const result = (await call(listCatalogItemsHandler)) as {
			items: CatalogItem[];
			total: number;
		};
		expect(result.items).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns items from controller", async () => {
		const items = [makeCatalogItem(), makeCatalogItem()];
		const ctrl = makeController({
			listCatalogItems: vi.fn().mockResolvedValue(items),
		});
		const result = (await call(listCatalogItemsHandler, {
			controller: ctrl,
		})) as { items: CatalogItem[]; total: number };
		expect(result.items).toHaveLength(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listCatalogItemsHandler, {
			query: { status: "active" },
			controller: ctrl,
		});
		expect(ctrl.listCatalogItems).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" }),
		);
	});
});

// ── POST /admin/pinterest-shop/sync ──────────────────────────────────────────

describe("admin POST /pinterest-shop/sync", () => {
	it("triggers catalog sync and returns sync record", async () => {
		const sync = makeCatalogSync({ syncedItems: 10 });
		const ctrl = makeController({
			syncCatalog: vi.fn().mockResolvedValue(sync),
		});
		const result = (await call(syncCatalogHandler, {
			controller: ctrl,
		})) as { sync: CatalogSync };
		expect(result.sync.syncedItems).toBe(10);
	});
});

// ── GET /admin/pinterest-shop/syncs ──────────────────────────────────────────

describe("admin GET /pinterest-shop/syncs", () => {
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

// ── POST /admin/pinterest-shop/pins/create ───────────────────────────────────

describe("admin POST /pinterest-shop/pins/create", () => {
	it("creates a pin and returns it", async () => {
		const pin = makePin({ catalogItemId: "item_1", title: "Pottery Pin" });
		const ctrl = makeController({
			createPin: vi.fn().mockResolvedValue(pin),
		});
		const result = (await call(createPinHandler, {
			body: {
				catalogItemId: "item_1",
				title: "Pottery Pin",
				link: "https://example.com/bowl",
				imageUrl: "https://example.com/bowl.jpg",
			},
			controller: ctrl,
		})) as { pin: ShoppingPin };
		expect(result.pin.title).toBe("Pottery Pin");
		expect(ctrl.createPin).toHaveBeenCalledWith(
			expect.objectContaining({ catalogItemId: "item_1" }),
		);
	});
});

// ── GET /admin/pinterest-shop/pins ───────────────────────────────────────────

describe("admin GET /pinterest-shop/pins", () => {
	it("returns empty list when no pins", async () => {
		const result = (await call(listPinsHandler)) as {
			pins: ShoppingPin[];
			total: number;
		};
		expect(result.pins).toHaveLength(0);
	});

	it("returns pins from controller", async () => {
		const pins = [makePin(), makePin()];
		const ctrl = makeController({
			listPins: vi.fn().mockResolvedValue(pins),
		});
		const result = (await call(listPinsHandler, {
			controller: ctrl,
		})) as { pins: ShoppingPin[]; total: number };
		expect(result.pins).toHaveLength(2);
	});
});

// ── GET /admin/pinterest-shop/stats ──────────────────────────────────────────

describe("admin GET /pinterest-shop/stats", () => {
	it("returns channel stats", async () => {
		const stats = makeChannelStats({ totalCatalogItems: 10, totalPins: 15 });
		const ctrl = makeController({
			getChannelStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(statsHandler, {
			controller: ctrl,
		})) as { stats: ChannelStats };
		expect(result.stats.totalCatalogItems).toBe(10);
		expect(result.stats.totalPins).toBe(15);
	});
});
