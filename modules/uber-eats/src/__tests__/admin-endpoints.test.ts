import { describe, expect, it, vi } from "vitest";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { listMenuSyncsEndpoint } from "../admin/endpoints/list-menu-syncs";
import { listOrdersEndpoint } from "../admin/endpoints/list-orders";
import { orderStatsEndpoint } from "../admin/endpoints/order-stats";
import { syncMenuAdminEndpoint } from "../admin/endpoints/sync-menu";
import type {
	MenuSync,
	OrderStats,
	UberEatsController,
	UberOrder,
} from "../service";

const mockVerifyConnection = vi.hoisted(() =>
	vi.fn().mockResolvedValue({ ok: true, scopes: [] }),
);

vi.mock("../provider", () => ({
	UberEatsProvider: class {
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

function makeOrder(overrides: Partial<UberOrder> = {}): UberOrder {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		externalOrderId: "ue_order_1",
		status: "pending",
		items: [],
		subtotal: 1599,
		deliveryFee: 299,
		tax: 128,
		total: 2026,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeMenuSync(overrides: Partial<MenuSync> = {}): MenuSync {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		status: "synced",
		itemCount: 25,
		startedAt: now,
		createdAt: now,
		...overrides,
	};
}

function makeOrderStats(overrides: Partial<OrderStats> = {}): OrderStats {
	return {
		total: 10,
		pending: 2,
		accepted: 1,
		preparing: 1,
		ready: 0,
		delivered: 5,
		cancelled: 1,
		totalRevenue: 20260,
		...overrides,
	};
}

function makeController(
	overrides: Partial<UberEatsController> = {},
): UberEatsController {
	return {
		receiveOrder: vi.fn().mockResolvedValue(makeOrder()),
		acceptOrder: vi.fn().mockResolvedValue(null),
		markReady: vi.fn().mockResolvedValue(null),
		cancelOrder: vi.fn().mockResolvedValue(null),
		getOrder: vi.fn().mockResolvedValue(null),
		listOrders: vi.fn().mockResolvedValue([]),
		syncMenu: vi.fn().mockResolvedValue(makeMenuSync()),
		getLastMenuSync: vi.fn().mockResolvedValue(null),
		listMenuSyncs: vi.fn().mockResolvedValue([]),
		getOrderStats: vi.fn().mockResolvedValue(makeOrderStats()),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: UberEatsController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { "uber-eats": opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const settingsHandler = extractHandler(
	createGetSettingsEndpoint({
		clientId: "CLIENT_ID_1",
		clientSecret: "CLIENT_SECRET_1",
		restaurantId: "REST_ID_1",
	}),
);
const settingsEmptyHandler = extractHandler(createGetSettingsEndpoint({}));
const listOrdersHandler = extractHandler(listOrdersEndpoint);
const listMenuSyncsHandler = extractHandler(listMenuSyncsEndpoint);
const syncMenuHandler = extractHandler(syncMenuAdminEndpoint);
const orderStatsHandler = extractHandler(orderStatsEndpoint);

// ── GET /admin/uber-eats/settings ────────────────────────────────────────────

describe("admin GET /uber-eats/settings", () => {
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
		mockVerifyConnection.mockResolvedValueOnce({ ok: true, scopes: [] });
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

	it("reports missing scopes when required scopes are absent", async () => {
		mockVerifyConnection.mockResolvedValueOnce({ ok: true, scopes: [] });
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { missingScopes: string[] };
		expect(result.missingScopes.length).toBeGreaterThan(0);
	});

	it("includes webhookUrl in response", async () => {
		mockVerifyConnection.mockResolvedValueOnce({ ok: true, scopes: [] });
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { webhookUrl: string };
		expect(result.webhookUrl).toBe("/api/uber-eats/webhook");
	});
});

// ── GET /admin/uber-eats/orders ───────────────────────────────────────────────

describe("admin GET /uber-eats/orders", () => {
	it("returns empty list when no orders", async () => {
		const result = (await call(listOrdersHandler)) as {
			orders: UberOrder[];
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
		})) as { orders: UberOrder[]; total: number };
		expect(result.orders).toHaveLength(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listOrdersHandler, {
			query: { status: "accepted" },
			controller: ctrl,
		});
		expect(ctrl.listOrders).toHaveBeenCalledWith(
			expect.objectContaining({ status: "accepted" }),
		);
	});
});

// ── GET /admin/uber-eats/menu-syncs ──────────────────────────────────────────

describe("admin GET /uber-eats/menu-syncs", () => {
	it("returns empty list when no syncs", async () => {
		const result = (await call(listMenuSyncsHandler)) as {
			syncs: MenuSync[];
			total: number;
		};
		expect(result.syncs).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns syncs from controller", async () => {
		const syncs = [makeMenuSync(), makeMenuSync({ itemCount: 30 })];
		const ctrl = makeController({
			listMenuSyncs: vi.fn().mockResolvedValue(syncs),
		});
		const result = (await call(listMenuSyncsHandler, {
			controller: ctrl,
		})) as { syncs: MenuSync[]; total: number };
		expect(result.syncs).toHaveLength(2);
	});
});

// ── POST /admin/uber-eats/menu-syncs/create ──────────────────────────────────

describe("admin POST /uber-eats/menu-syncs/create", () => {
	it("triggers menu sync and returns sync record", async () => {
		const sync = makeMenuSync({ itemCount: 25, status: "synced" });
		const ctrl = makeController({
			syncMenu: vi.fn().mockResolvedValue(sync),
		});
		const result = (await call(syncMenuHandler, {
			body: { itemCount: 25 },
			controller: ctrl,
		})) as { sync: MenuSync };
		expect(result.sync.itemCount).toBe(25);
		expect(result.sync.status).toBe("synced");
		expect(ctrl.syncMenu).toHaveBeenCalledWith(25);
	});
});

// ── GET /admin/uber-eats/stats ────────────────────────────────────────────────

describe("admin GET /uber-eats/stats", () => {
	it("returns order stats", async () => {
		const stats = makeOrderStats({ total: 10, delivered: 5 });
		const ctrl = makeController({
			getOrderStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(orderStatsHandler, {
			controller: ctrl,
		})) as { stats: OrderStats };
		expect(result.stats.total).toBe(10);
		expect(result.stats.delivered).toBe(5);
	});
});
