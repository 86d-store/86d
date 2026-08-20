import { describe, expect, it, vi } from "vitest";
import { createMenuMappingEndpoint } from "../admin/endpoints/create-menu-mapping";
import { deleteMenuMappingEndpoint } from "../admin/endpoints/delete-menu-mapping";
import { createGetSettingsEndpoint } from "../admin/endpoints/get-settings";
import { listMenuMappingsEndpoint } from "../admin/endpoints/list-menu-mappings";
import { listSyncRecordsEndpoint } from "../admin/endpoints/list-sync-records";
import { syncStatsEndpoint } from "../admin/endpoints/sync-stats";
import type {
	MenuMapping,
	SyncRecord,
	SyncStats,
	ToastController,
} from "../service";

const mockVerifyConnection = vi.hoisted(() =>
	vi.fn().mockResolvedValue({ ok: true, menuCount: 3 }),
);

vi.mock("../provider", () => ({
	ToastPosProvider: class {
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

function makeSyncRecord(overrides: Partial<SyncRecord> = {}): SyncRecord {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		entityType: "menu-item",
		entityId: "entity_1",
		externalId: "ext_1",
		direction: "outbound",
		status: "synced",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeMenuMapping(overrides: Partial<MenuMapping> = {}): MenuMapping {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		localProductId: "prod_1",
		externalMenuItemId: "toast_item_1",
		isActive: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeSyncStats(overrides: Partial<SyncStats> = {}): SyncStats {
	return {
		total: 10,
		pending: 1,
		synced: 8,
		failed: 1,
		byEntityType: { "menu-item": 5, order: 3, inventory: 2 },
		...overrides,
	};
}

function makeController(
	overrides: Partial<ToastController> = {},
): ToastController {
	return {
		syncMenu: vi.fn().mockResolvedValue(makeSyncRecord()),
		syncOrder: vi.fn().mockResolvedValue(makeSyncRecord()),
		syncInventory: vi.fn().mockResolvedValue(makeSyncRecord()),
		getSyncRecord: vi.fn().mockResolvedValue(null),
		listSyncRecords: vi.fn().mockResolvedValue([]),
		createMenuMapping: vi.fn().mockResolvedValue(makeMenuMapping()),
		getMenuMapping: vi.fn().mockResolvedValue(null),
		listMenuMappings: vi.fn().mockResolvedValue([]),
		deleteMenuMapping: vi.fn().mockResolvedValue(false),
		getLastSyncTime: vi.fn().mockResolvedValue(null),
		getSyncStats: vi.fn().mockResolvedValue(makeSyncStats()),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: ToastController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { toast: opts.controller ?? makeController() } },
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const settingsHandler = extractHandler(
	createGetSettingsEndpoint({
		apiKey: "api_key_1",
		restaurantGuid: "guid_1",
		sandbox: true,
	}),
);
const settingsEmptyHandler = extractHandler(createGetSettingsEndpoint({}));
const createMenuMappingHandler = extractHandler(createMenuMappingEndpoint);
const deleteMenuMappingHandler = extractHandler(deleteMenuMappingEndpoint);
const listMenuMappingsHandler = extractHandler(listMenuMappingsEndpoint);
const listSyncRecordsHandler = extractHandler(listSyncRecordsEndpoint);
const syncStatsHandler = extractHandler(syncStatsEndpoint);

// ── GET /admin/toast/settings ─────────────────────────────────────────────────

describe("admin GET /toast/settings", () => {
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
		mockVerifyConnection.mockResolvedValueOnce({ ok: true, menuCount: 3 });
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { status: string; configured: boolean; menuCount: number };
		expect(result.status).toBe("connected");
		expect(result.configured).toBe(true);
		expect(result.menuCount).toBe(3);
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

	it("includes sandbox flag in response", async () => {
		mockVerifyConnection.mockResolvedValueOnce({ ok: true, menuCount: 2 });
		const result = (await settingsHandler({
			query: {},
			params: {},
			body: {},
			context: { controllers: {} },
		})) as { sandbox: boolean };
		expect(result.sandbox).toBe(true);
	});
});

// ── POST /admin/toast/menu-mappings/create ───────────────────────────────────

describe("admin POST /toast/menu-mappings/create", () => {
	it("creates a menu mapping and returns it", async () => {
		const mapping = makeMenuMapping({
			localProductId: "prod_1",
			externalMenuItemId: "toast_burger",
		});
		const ctrl = makeController({
			createMenuMapping: vi.fn().mockResolvedValue(mapping),
		});
		const result = (await call(createMenuMappingHandler, {
			body: {
				localProductId: "prod_1",
				externalMenuItemId: "toast_burger",
			},
			controller: ctrl,
		})) as { mapping: MenuMapping };
		expect(result.mapping.localProductId).toBe("prod_1");
		expect(result.mapping.externalMenuItemId).toBe("toast_burger");
		expect(ctrl.createMenuMapping).toHaveBeenCalledWith({
			localProductId: "prod_1",
			externalMenuItemId: "toast_burger",
		});
	});
});

// ── DELETE /admin/toast/menu-mappings/:id/delete ─────────────────────────────

describe("admin DELETE /toast/menu-mappings/:id/delete", () => {
	it("returns deleted: false when not found", async () => {
		const result = (await call(deleteMenuMappingHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("deletes mapping and returns deleted: true", async () => {
		const ctrl = makeController({
			deleteMenuMapping: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteMenuMappingHandler, {
			params: { id: "map_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
		expect(ctrl.deleteMenuMapping).toHaveBeenCalledWith("map_1");
	});
});

// ── GET /admin/toast/menu-mappings ───────────────────────────────────────────

describe("admin GET /toast/menu-mappings", () => {
	it("returns empty list when no mappings", async () => {
		const result = (await call(listMenuMappingsHandler)) as {
			mappings: MenuMapping[];
			total: number;
		};
		expect(result.mappings).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns mappings from controller", async () => {
		const mappings = [makeMenuMapping(), makeMenuMapping()];
		const ctrl = makeController({
			listMenuMappings: vi.fn().mockResolvedValue(mappings),
		});
		const result = (await call(listMenuMappingsHandler, {
			controller: ctrl,
		})) as { mappings: MenuMapping[]; total: number };
		expect(result.mappings).toHaveLength(2);
	});

	it("forwards isActive filter to controller", async () => {
		const ctrl = makeController();
		await call(listMenuMappingsHandler, {
			query: { isActive: "true" },
			controller: ctrl,
		});
		expect(ctrl.listMenuMappings).toHaveBeenCalledWith(
			expect.objectContaining({ isActive: true }),
		);
	});
});

// ── GET /admin/toast/sync-records ────────────────────────────────────────────

describe("admin GET /toast/sync-records", () => {
	it("returns empty list when no records", async () => {
		const result = (await call(listSyncRecordsHandler)) as {
			records: SyncRecord[];
			total: number;
		};
		expect(result.records).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns sync records from controller", async () => {
		const records = [
			makeSyncRecord({ entityType: "menu-item" }),
			makeSyncRecord({ entityType: "order" }),
		];
		const ctrl = makeController({
			listSyncRecords: vi.fn().mockResolvedValue(records),
		});
		const result = (await call(listSyncRecordsHandler, {
			controller: ctrl,
		})) as { records: SyncRecord[]; total: number };
		expect(result.records).toHaveLength(2);
	});

	it("forwards entityType and status filters to controller", async () => {
		const ctrl = makeController();
		await call(listSyncRecordsHandler, {
			query: { entityType: "menu-item", status: "synced" },
			controller: ctrl,
		});
		expect(ctrl.listSyncRecords).toHaveBeenCalledWith(
			expect.objectContaining({ entityType: "menu-item", status: "synced" }),
		);
	});
});

// ── GET /admin/toast/sync-stats ───────────────────────────────────────────────

describe("admin GET /toast/sync-stats", () => {
	it("returns sync statistics", async () => {
		const stats = makeSyncStats({ total: 10, synced: 8, failed: 2 });
		const ctrl = makeController({
			getSyncStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(syncStatsHandler, {
			controller: ctrl,
		})) as { stats: SyncStats };
		expect(result.stats.total).toBe(10);
		expect(result.stats.synced).toBe(8);
		expect(result.stats.failed).toBe(2);
	});
});
