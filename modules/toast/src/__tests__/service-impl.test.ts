import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToastMenuItem, ToastOrder, ToastStockItem } from "../provider";
import { createToastController } from "../service-impl";

// ── Provider mock ──────────────────────────────────────────────────────────

const mockProvider = {
	getMenus: vi.fn(),
	getMenuItem: vi.fn<() => Promise<ToastMenuItem>>(),
	getOrders: vi.fn(),
	getOrder: vi.fn<() => Promise<ToastOrder>>(),
	getInventory: vi.fn<() => Promise<ToastStockItem[]>>(),
	updateStock: vi.fn(),
};

const mockEvents = {
	emit: vi.fn(),
};

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeMenuItem(overrides: Partial<ToastMenuItem> = {}): ToastMenuItem {
	return {
		guid: "menu-item-guid-1",
		name: "Cheeseburger",
		description: "Classic burger",
		price: 12.99,
		visibility: "ALL",
		...overrides,
	};
}

function makeOrder(overrides: Partial<ToastOrder> = {}): ToastOrder {
	return {
		guid: "order-guid-1",
		entityType: "Order",
		displayNumber: "42",
		createdDate: "2026-03-27T10:00:00Z",
		modifiedDate: "2026-03-27T10:05:00Z",
		totalAmount: 25.99,
		checks: [],
		...overrides,
	};
}

// ── Tests with provider (credentials configured) ───────────────────────────

describe("toast service-impl with provider", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createToastController>;

	beforeEach(() => {
		mockData = createMockDataService();
		vi.clearAllMocks();

		controller = createToastController(
			mockData,
			mockEvents as never,
			mockProvider as never,
		);
	});

	// ── syncMenu ─────────────────────────────────────────────────────

	describe("syncMenu", () => {
		it("creates a sync record for menu items", async () => {
			mockProvider.getMenuItem.mockResolvedValue(makeMenuItem());

			const record = await controller.syncMenu({
				entityId: "local-product-1",
				externalId: "menu-item-guid-1",
				direction: "inbound",
			});

			expect(record.entityType).toBe("menu-item");
			expect(record.entityId).toBe("local-product-1");
			expect(record.externalId).toBe("menu-item-guid-1");
			expect(record.direction).toBe("inbound");
			expect(record.status).toBe("synced");
			expect(record.id).toBeTruthy();
			expect(record.createdAt).toBeInstanceOf(Date);
			expect(record.updatedAt).toBeInstanceOf(Date);
		});

		it("calls provider.getMenuItem on inbound sync", async () => {
			mockProvider.getMenuItem.mockResolvedValue(makeMenuItem());

			await controller.syncMenu({
				entityId: "local-1",
				externalId: "ext-guid-1",
				direction: "inbound",
			});

			expect(mockProvider.getMenuItem).toHaveBeenCalledWith("ext-guid-1");
		});

		it("does not call provider on outbound sync", async () => {
			await controller.syncMenu({
				entityId: "local-1",
				externalId: "ext-guid-1",
				direction: "outbound",
			});

			expect(mockProvider.getMenuItem).not.toHaveBeenCalled();
		});

		it("sets status to failed when provider throws", async () => {
			mockProvider.getMenuItem.mockRejectedValue(
				new Error("Toast API error: HTTP 404"),
			);

			const record = await controller.syncMenu({
				entityId: "local-1",
				externalId: "missing-guid",
				direction: "inbound",
			});

			expect(record.status).toBe("failed");
			expect(record.error).toBe("Toast API error: HTTP 404");
		});

		it("defaults direction to outbound", async () => {
			const record = await controller.syncMenu({
				entityId: "local-1",
				externalId: "ext-1",
			});

			expect(record.direction).toBe("outbound");
		});

		it("emits toast.menu.synced event", async () => {
			const record = await controller.syncMenu({
				entityId: "local-1",
				externalId: "ext-1",
			});

			expect(mockEvents.emit).toHaveBeenCalledWith("toast.menu.synced", {
				syncRecordId: record.id,
				entityType: "menu-item",
				entityId: "local-1",
				externalId: "ext-1",
			});
		});

		it("persists the sync record to data store", async () => {
			const record = await controller.syncMenu({
				entityId: "local-1",
				externalId: "ext-1",
			});

			expect(mockData.size("syncRecord")).toBe(1);
			const stored = await mockData.get("syncRecord", record.id);
			expect(stored).not.toBeNull();
		});
	});

	// ── syncOrder ────────────────────────────────────────────────────

	describe("syncOrder", () => {
		it("creates a sync record for orders", async () => {
			mockProvider.getOrder.mockResolvedValue(makeOrder());

			const record = await controller.syncOrder({
				entityId: "local-order-1",
				externalId: "order-guid-1",
				direction: "inbound",
			});

			expect(record.entityType).toBe("order");
			expect(record.entityId).toBe("local-order-1");
			expect(record.externalId).toBe("order-guid-1");
			expect(record.status).toBe("synced");
		});

		it("calls provider.getOrder on inbound sync", async () => {
			mockProvider.getOrder.mockResolvedValue(makeOrder());

			await controller.syncOrder({
				entityId: "local-order-1",
				externalId: "order-guid-1",
				direction: "inbound",
			});

			expect(mockProvider.getOrder).toHaveBeenCalledWith("order-guid-1");
		});

		it("does not call provider on outbound sync", async () => {
			await controller.syncOrder({
				entityId: "local-order-1",
				externalId: "order-guid-1",
				direction: "outbound",
			});

			expect(mockProvider.getOrder).not.toHaveBeenCalled();
		});

		it("sets status to failed when provider throws", async () => {
			mockProvider.getOrder.mockRejectedValue(
				new Error("Toast API error: HTTP 500"),
			);

			const record = await controller.syncOrder({
				entityId: "local-order-1",
				externalId: "order-guid-1",
				direction: "inbound",
			});

			expect(record.status).toBe("failed");
			expect(record.error).toBe("Toast API error: HTTP 500");
		});

		it("emits toast.order.synced event", async () => {
			const record = await controller.syncOrder({
				entityId: "local-order-1",
				externalId: "order-guid-1",
			});

			expect(mockEvents.emit).toHaveBeenCalledWith("toast.order.synced", {
				syncRecordId: record.id,
				entityType: "order",
				entityId: "local-order-1",
				externalId: "order-guid-1",
			});
		});
	});

	// ── syncInventory ────────────────────────────────────────────────

	describe("syncInventory", () => {
		it("creates a sync record for inventory", async () => {
			mockProvider.getInventory.mockResolvedValue([
				{
					guid: "stock-1",
					menuItemGuid: "item-1",
					quantity: 10,
					status: "IN_STOCK" as const,
				},
			]);

			const record = await controller.syncInventory({
				entityId: "local-inv-1",
				externalId: "stock-1",
			});

			expect(record.entityType).toBe("inventory");
			expect(record.status).toBe("synced");
		});

		it("calls provider.getInventory regardless of direction", async () => {
			mockProvider.getInventory.mockResolvedValue([]);

			await controller.syncInventory({
				entityId: "local-inv-1",
				externalId: "stock-1",
				direction: "outbound",
			});

			expect(mockProvider.getInventory).toHaveBeenCalled();
		});

		it("sets status to failed when provider throws", async () => {
			mockProvider.getInventory.mockRejectedValue(
				new Error("Toast API error: HTTP 403"),
			);

			const record = await controller.syncInventory({
				entityId: "local-inv-1",
				externalId: "stock-1",
			});

			expect(record.status).toBe("failed");
			expect(record.error).toBe("Toast API error: HTTP 403");
		});

		it("emits toast.inventory.updated event", async () => {
			mockProvider.getInventory.mockResolvedValue([]);

			const record = await controller.syncInventory({
				entityId: "local-inv-1",
				externalId: "stock-1",
			});

			expect(mockEvents.emit).toHaveBeenCalledWith("toast.inventory.updated", {
				syncRecordId: record.id,
				entityType: "inventory",
				entityId: "local-inv-1",
				externalId: "stock-1",
			});
		});
	});

	// ── getSyncRecord ────────────────────────────────────────────────

	describe("getSyncRecord", () => {
		it("returns null for missing record", async () => {
			expect(await controller.getSyncRecord("nonexistent")).toBeNull();
		});

		it("returns a stored sync record", async () => {
			const record = await controller.syncMenu({
				entityId: "local-1",
				externalId: "ext-1",
			});

			const fetched = await controller.getSyncRecord(record.id);
			expect(fetched?.id).toBe(record.id);
			expect(fetched?.entityType).toBe("menu-item");
		});
	});

	// ── listSyncRecords ──────────────────────────────────────────────

	describe("listSyncRecords", () => {
		it("lists all sync records", async () => {
			await controller.syncMenu({ entityId: "m1", externalId: "e1" });
			await controller.syncOrder({ entityId: "o1", externalId: "e2" });

			const records = await controller.listSyncRecords();
			expect(records).toHaveLength(2);
		});

		it("filters by entityType", async () => {
			await controller.syncMenu({ entityId: "m1", externalId: "e1" });
			await controller.syncOrder({ entityId: "o1", externalId: "e2" });
			mockProvider.getInventory.mockResolvedValue([]);
			await controller.syncInventory({ entityId: "i1", externalId: "e3" });

			const menuRecords = await controller.listSyncRecords({
				entityType: "menu-item",
			});
			expect(menuRecords).toHaveLength(1);
			expect(menuRecords[0].entityType).toBe("menu-item");
		});

		it("filters by status", async () => {
			await controller.syncMenu({ entityId: "m1", externalId: "e1" });

			mockProvider.getMenuItem.mockRejectedValue(new Error("API error"));
			await controller.syncMenu({
				entityId: "m2",
				externalId: "e2",
				direction: "inbound",
			});

			const failed = await controller.listSyncRecords({ status: "failed" });
			expect(failed).toHaveLength(1);
			expect(failed[0].status).toBe("failed");
		});

		it("supports pagination with take and skip", async () => {
			await controller.syncMenu({ entityId: "m1", externalId: "e1" });
			await controller.syncMenu({ entityId: "m2", externalId: "e2" });
			await controller.syncMenu({ entityId: "m3", externalId: "e3" });

			const page = await controller.listSyncRecords({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});

		it("returns empty array when no records match", async () => {
			const records = await controller.listSyncRecords({
				entityType: "order",
			});
			expect(records).toHaveLength(0);
		});
	});

	// ── Menu mappings ────────────────────────────────────────────────

	describe("createMenuMapping", () => {
		it("creates a mapping between local product and Toast menu item", async () => {
			const mapping = await controller.createMenuMapping({
				localProductId: "prod-1",
				externalMenuItemId: "toast-guid-1",
			});

			expect(mapping.localProductId).toBe("prod-1");
			expect(mapping.externalMenuItemId).toBe("toast-guid-1");
			expect(mapping.isActive).toBe(true);
			expect(mapping.id).toBeTruthy();
			expect(mapping.createdAt).toBeInstanceOf(Date);
			expect(mapping.updatedAt).toBeInstanceOf(Date);
		});

		it("persists the mapping to data store", async () => {
			const mapping = await controller.createMenuMapping({
				localProductId: "prod-1",
				externalMenuItemId: "toast-guid-1",
			});

			expect(mockData.size("menuMapping")).toBe(1);
			const stored = await mockData.get("menuMapping", mapping.id);
			expect(stored).not.toBeNull();
		});
	});

	describe("getMenuMapping", () => {
		it("returns null for missing mapping", async () => {
			expect(await controller.getMenuMapping("nonexistent")).toBeNull();
		});

		it("returns a stored mapping", async () => {
			const mapping = await controller.createMenuMapping({
				localProductId: "prod-1",
				externalMenuItemId: "toast-guid-1",
			});

			const fetched = await controller.getMenuMapping(mapping.id);
			expect(fetched?.localProductId).toBe("prod-1");
			expect(fetched?.externalMenuItemId).toBe("toast-guid-1");
		});
	});

	describe("listMenuMappings", () => {
		it("lists all mappings", async () => {
			await controller.createMenuMapping({
				localProductId: "prod-1",
				externalMenuItemId: "toast-1",
			});
			await controller.createMenuMapping({
				localProductId: "prod-2",
				externalMenuItemId: "toast-2",
			});

			const mappings = await controller.listMenuMappings();
			expect(mappings).toHaveLength(2);
		});

		it("filters by isActive", async () => {
			await controller.createMenuMapping({
				localProductId: "prod-1",
				externalMenuItemId: "toast-1",
			});

			// All mappings start as active, so filtering for active returns all
			const active = await controller.listMenuMappings({ isActive: true });
			expect(active).toHaveLength(1);
			expect(active[0].isActive).toBe(true);
		});

		it("supports pagination", async () => {
			await controller.createMenuMapping({
				localProductId: "p1",
				externalMenuItemId: "t1",
			});
			await controller.createMenuMapping({
				localProductId: "p2",
				externalMenuItemId: "t2",
			});
			await controller.createMenuMapping({
				localProductId: "p3",
				externalMenuItemId: "t3",
			});

			const page = await controller.listMenuMappings({ take: 2 });
			expect(page).toHaveLength(2);
		});

		it("returns empty array when no mappings exist", async () => {
			const mappings = await controller.listMenuMappings();
			expect(mappings).toHaveLength(0);
		});
	});

	describe("deleteMenuMapping", () => {
		it("deletes an existing mapping", async () => {
			const mapping = await controller.createMenuMapping({
				localProductId: "prod-1",
				externalMenuItemId: "toast-1",
			});

			const result = await controller.deleteMenuMapping(mapping.id);
			expect(result).toBe(true);
			expect(mockData.size("menuMapping")).toBe(0);
		});

		it("returns false for nonexistent mapping", async () => {
			const result = await controller.deleteMenuMapping("nonexistent");
			expect(result).toBe(false);
		});
	});

	// ── getLastSyncTime ──────────────────────────────────────────────

	describe("getLastSyncTime", () => {
		it("returns null when no sync records exist", async () => {
			expect(await controller.getLastSyncTime()).toBeNull();
		});

		it("returns the latest syncedAt from all synced records", async () => {
			await controller.syncMenu({ entityId: "m1", externalId: "e1" });
			await controller.syncOrder({ entityId: "o1", externalId: "e2" });

			const lastSync = await controller.getLastSyncTime();
			expect(lastSync).toBeInstanceOf(Date);
		});

		it("filters by entity type", async () => {
			await controller.syncMenu({ entityId: "m1", externalId: "e1" });
			await controller.syncOrder({ entityId: "o1", externalId: "e2" });

			const menuSync = await controller.getLastSyncTime("menu-item");
			expect(menuSync).toBeInstanceOf(Date);
		});

		it("ignores failed sync records", async () => {
			mockProvider.getMenuItem.mockRejectedValue(new Error("API error"));
			await controller.syncMenu({
				entityId: "m1",
				externalId: "e1",
				direction: "inbound",
			});

			const lastSync = await controller.getLastSyncTime("menu-item");
			expect(lastSync).toBeNull();
		});

		it("returns null when only failed records exist for given type", async () => {
			// Create a successful order sync
			await controller.syncOrder({ entityId: "o1", externalId: "e1" });

			// Create a failed menu sync
			mockProvider.getMenuItem.mockRejectedValue(new Error("API error"));
			await controller.syncMenu({
				entityId: "m1",
				externalId: "e2",
				direction: "inbound",
			});

			// Menu-item filter should return null (only failed records)
			const menuSync = await controller.getLastSyncTime("menu-item");
			expect(menuSync).toBeNull();

			// Order filter should return a date (has successful record)
			const orderSync = await controller.getLastSyncTime("order");
			expect(orderSync).toBeInstanceOf(Date);
		});
	});

	// ── getSyncStats ─────────────────────────────────────────────────

	describe("getSyncStats", () => {
		it("returns zeroed stats when no records exist", async () => {
			const stats = await controller.getSyncStats();
			expect(stats.total).toBe(0);
			expect(stats.pending).toBe(0);
			expect(stats.synced).toBe(0);
			expect(stats.failed).toBe(0);
			expect(stats.byEntityType).toEqual({});
		});

		it("counts records by status", async () => {
			// 2 synced
			await controller.syncMenu({ entityId: "m1", externalId: "e1" });
			await controller.syncOrder({ entityId: "o1", externalId: "e2" });

			// 1 failed
			mockProvider.getMenuItem.mockRejectedValue(new Error("fail"));
			await controller.syncMenu({
				entityId: "m2",
				externalId: "e3",
				direction: "inbound",
			});

			const stats = await controller.getSyncStats();
			expect(stats.total).toBe(3);
			expect(stats.synced).toBe(2);
			expect(stats.failed).toBe(1);
		});

		it("groups by entity type", async () => {
			await controller.syncMenu({ entityId: "m1", externalId: "e1" });
			await controller.syncMenu({ entityId: "m2", externalId: "e2" });
			await controller.syncOrder({ entityId: "o1", externalId: "e3" });
			mockProvider.getInventory.mockResolvedValue([]);
			await controller.syncInventory({ entityId: "i1", externalId: "e4" });

			const stats = await controller.getSyncStats();
			expect(stats.byEntityType["menu-item"]).toBe(2);
			expect(stats.byEntityType.order).toBe(1);
			expect(stats.byEntityType.inventory).toBe(1);
		});
	});
});

// ── Tests without provider (no credentials) ─────────────────────────────────

describe("toast service-impl without provider", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createToastController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createToastController(mockData);
	});

	it("creates synced record without calling any provider", async () => {
		const record = await controller.syncMenu({
			entityId: "local-1",
			externalId: "ext-1",
			direction: "inbound",
		});

		expect(record.status).toBe("synced");
		expect(record.error).toBeUndefined();
	});

	it("creates sync records for all entity types", async () => {
		const menu = await controller.syncMenu({
			entityId: "m1",
			externalId: "e1",
		});
		const order = await controller.syncOrder({
			entityId: "o1",
			externalId: "e2",
		});
		const inv = await controller.syncInventory({
			entityId: "i1",
			externalId: "e3",
		});

		expect(menu.entityType).toBe("menu-item");
		expect(order.entityType).toBe("order");
		expect(inv.entityType).toBe("inventory");
		expect(mockData.size("syncRecord")).toBe(3);
	});

	it("handles menu mappings without provider", async () => {
		const mapping = await controller.createMenuMapping({
			localProductId: "prod-1",
			externalMenuItemId: "toast-1",
		});

		expect(mapping.isActive).toBe(true);

		const fetched = await controller.getMenuMapping(mapping.id);
		expect(fetched?.localProductId).toBe("prod-1");

		const deleted = await controller.deleteMenuMapping(mapping.id);
		expect(deleted).toBe(true);
		expect(mockData.size("menuMapping")).toBe(0);
	});

	it("computes sync stats without provider", async () => {
		await controller.syncMenu({ entityId: "m1", externalId: "e1" });
		await controller.syncMenu({ entityId: "m2", externalId: "e2" });
		await controller.syncOrder({ entityId: "o1", externalId: "e3" });

		const stats = await controller.getSyncStats();
		expect(stats.total).toBe(3);
		expect(stats.synced).toBe(3);
		expect(stats.failed).toBe(0);
	});

	it("does not emit events when emitter is not provided", async () => {
		// No events emitter passed — should not throw
		await controller.syncMenu({ entityId: "m1", externalId: "e1" });
		// If we got here without throwing, events are safely skipped
	});
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("toast service-impl edge cases", () => {
	it("handles non-Error thrown from provider", async () => {
		const mockData = createMockDataService();
		const badProvider = {
			getMenus: vi.fn(),
			getMenuItem: vi.fn().mockRejectedValue("string error"),
			getOrders: vi.fn(),
			getOrder: vi.fn(),
			getInventory: vi.fn(),
			updateStock: vi.fn(),
		};

		const controller = createToastController(
			mockData,
			undefined,
			badProvider as never,
		);

		const record = await controller.syncMenu({
			entityId: "m1",
			externalId: "e1",
			direction: "inbound",
		});

		expect(record.status).toBe("failed");
		expect(record.error).toBe("Toast API call failed");
	});

	it("assigns unique IDs to each sync record", async () => {
		const mockData = createMockDataService();
		const controller = createToastController(mockData);

		const r1 = await controller.syncMenu({
			entityId: "m1",
			externalId: "e1",
		});
		const r2 = await controller.syncMenu({
			entityId: "m2",
			externalId: "e2",
		});

		expect(r1.id).not.toBe(r2.id);
	});

	it("assigns unique IDs to each menu mapping", async () => {
		const mockData = createMockDataService();
		const controller = createToastController(mockData);

		const m1 = await controller.createMenuMapping({
			localProductId: "p1",
			externalMenuItemId: "t1",
		});
		const m2 = await controller.createMenuMapping({
			localProductId: "p2",
			externalMenuItemId: "t2",
		});

		expect(m1.id).not.toBe(m2.id);
	});

	it("sets syncedAt only on synced records", async () => {
		const mockData = createMockDataService();
		const failProvider = {
			getMenus: vi.fn(),
			getMenuItem: vi
				.fn()
				.mockRejectedValue(new Error("Toast API error: HTTP 503")),
			getOrders: vi.fn(),
			getOrder: vi.fn(),
			getInventory: vi.fn(),
			updateStock: vi.fn(),
		};

		const controller = createToastController(
			mockData,
			undefined,
			failProvider as never,
		);

		const failed = await controller.syncMenu({
			entityId: "m1",
			externalId: "e1",
			direction: "inbound",
		});
		expect(failed.syncedAt).toBeUndefined();

		const controller2 = createToastController(mockData);
		const synced = await controller2.syncMenu({
			entityId: "m2",
			externalId: "e2",
		});
		expect(synced.syncedAt).toBeInstanceOf(Date);
	});
});
