import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createToastController } from "../service-impl";

describe("toast controller", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createToastController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createToastController(mockData);
	});

	// ── Sync operations ──────────────────────────────────────────────

	describe("syncMenu", () => {
		it("creates a sync record for menu items", async () => {
			const record = await controller.syncMenu({
				entityId: "product-1",
				externalId: "toast-item-1",
			});
			expect(record.id).toBeDefined();
			expect(record.entityType).toBe("menu-item");
			expect(record.status).toBe("synced");
			expect(record.direction).toBe("outbound");
			expect(record.syncedAt).toBeInstanceOf(Date);
		});

		it("creates inbound sync record", async () => {
			const record = await controller.syncMenu({
				entityId: "product-2",
				externalId: "toast-item-2",
				direction: "inbound",
			});
			expect(record.direction).toBe("inbound");
		});
	});

	describe("syncOrder", () => {
		it("creates a sync record for orders", async () => {
			const record = await controller.syncOrder({
				entityId: "order-1",
				externalId: "toast-order-1",
			});
			expect(record.entityType).toBe("order");
			expect(record.status).toBe("synced");
		});

		it("supports inbound direction", async () => {
			const record = await controller.syncOrder({
				entityId: "order-2",
				externalId: "toast-order-2",
				direction: "inbound",
			});
			expect(record.direction).toBe("inbound");
		});
	});

	describe("syncInventory", () => {
		it("creates a sync record for inventory", async () => {
			const record = await controller.syncInventory({
				entityId: "inv-1",
				externalId: "toast-inv-1",
			});
			expect(record.entityType).toBe("inventory");
			expect(record.status).toBe("synced");
		});
	});

	// ── Sync record retrieval ────────────────────────────────────────

	describe("getSyncRecord", () => {
		it("retrieves an existing record", async () => {
			const created = await controller.syncMenu({
				entityId: "p-1",
				externalId: "t-1",
			});
			const found = await controller.getSyncRecord(created.id);
			expect(found).not.toBeNull();
			expect(found?.entityId).toBe("p-1");
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.getSyncRecord("non-existent");
			expect(result).toBeNull();
		});
	});

	describe("listSyncRecords", () => {
		it("lists all sync records", async () => {
			await controller.syncMenu({ entityId: "p-1", externalId: "t-1" });
			await controller.syncOrder({ entityId: "o-1", externalId: "to-1" });
			await controller.syncInventory({
				entityId: "i-1",
				externalId: "ti-1",
			});
			const all = await controller.listSyncRecords();
			expect(all).toHaveLength(3);
		});

		it("filters by entity type", async () => {
			await controller.syncMenu({ entityId: "p-1", externalId: "t-1" });
			await controller.syncOrder({ entityId: "o-1", externalId: "to-1" });
			const menus = await controller.listSyncRecords({
				entityType: "menu-item",
			});
			expect(menus).toHaveLength(1);
			expect(menus[0].entityType).toBe("menu-item");
		});

		it("filters by status", async () => {
			await controller.syncMenu({ entityId: "p-1", externalId: "t-1" });
			const synced = await controller.listSyncRecords({ status: "synced" });
			expect(synced).toHaveLength(1);
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.syncMenu({
					entityId: `p-${i}`,
					externalId: `t-${i}`,
				});
			}
			const page = await controller.listSyncRecords({ take: 2 });
			expect(page).toHaveLength(2);
		});

		it("returns empty array when skip exceeds total", async () => {
			await controller.syncMenu({ entityId: "p-1", externalId: "t-1" });
			const result = await controller.listSyncRecords({ skip: 100 });
			expect(result).toEqual([]);
		});
	});

	// ── Menu mapping CRUD ────────────────────────────────────────────

	describe("createMenuMapping", () => {
		it("creates a mapping with active status", async () => {
			const mapping = await controller.createMenuMapping({
				localProductId: "prod-1",
				externalMenuItemId: "toast-1",
			});
			expect(mapping.id).toBeDefined();
			expect(mapping.localProductId).toBe("prod-1");
			expect(mapping.externalMenuItemId).toBe("toast-1");
			expect(mapping.isActive).toBe(true);
		});

		it("sets createdAt and updatedAt", async () => {
			const before = new Date();
			const mapping = await controller.createMenuMapping({
				localProductId: "prod-2",
				externalMenuItemId: "toast-2",
			});
			const after = new Date();
			expect(mapping.createdAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(mapping.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});
	});

	describe("getMenuMapping", () => {
		it("retrieves an existing mapping", async () => {
			const created = await controller.createMenuMapping({
				localProductId: "prod-3",
				externalMenuItemId: "toast-3",
			});
			const found = await controller.getMenuMapping(created.id);
			expect(found).not.toBeNull();
			expect(found?.localProductId).toBe("prod-3");
		});

		it("returns null for non-existent mapping", async () => {
			const result = await controller.getMenuMapping("non-existent");
			expect(result).toBeNull();
		});
	});

	describe("listMenuMappings", () => {
		it("lists all mappings", async () => {
			await controller.createMenuMapping({
				localProductId: "p-1",
				externalMenuItemId: "t-1",
			});
			await controller.createMenuMapping({
				localProductId: "p-2",
				externalMenuItemId: "t-2",
			});
			const all = await controller.listMenuMappings();
			expect(all).toHaveLength(2);
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createMenuMapping({
					localProductId: `p-${i}`,
					externalMenuItemId: `t-${i}`,
				});
			}
			const page = await controller.listMenuMappings({ take: 3 });
			expect(page).toHaveLength(3);
		});
	});

	describe("deleteMenuMapping", () => {
		it("deletes an existing mapping", async () => {
			const mapping = await controller.createMenuMapping({
				localProductId: "p-1",
				externalMenuItemId: "t-1",
			});
			const result = await controller.deleteMenuMapping(mapping.id);
			expect(result).toBe(true);
		});

		it("returns false for non-existent mapping", async () => {
			const result = await controller.deleteMenuMapping("non-existent");
			expect(result).toBe(false);
		});

		it("double deletion returns false", async () => {
			const mapping = await controller.createMenuMapping({
				localProductId: "p-1",
				externalMenuItemId: "t-1",
			});
			await controller.deleteMenuMapping(mapping.id);
			const result = await controller.deleteMenuMapping(mapping.id);
			expect(result).toBe(false);
		});

		it("deleted mapping no longer appears in list", async () => {
			const m1 = await controller.createMenuMapping({
				localProductId: "p-1",
				externalMenuItemId: "t-1",
			});
			await controller.createMenuMapping({
				localProductId: "p-2",
				externalMenuItemId: "t-2",
			});
			await controller.deleteMenuMapping(m1.id);
			const all = await controller.listMenuMappings();
			expect(all).toHaveLength(1);
		});
	});

	// ── Last sync time ───────────────────────────────────────────────

	describe("getLastSyncTime", () => {
		it("returns null when no sync records exist", async () => {
			const result = await controller.getLastSyncTime();
			expect(result).toBeNull();
		});

		it("returns latest sync time across all types", async () => {
			await controller.syncMenu({ entityId: "p-1", externalId: "t-1" });
			await controller.syncOrder({ entityId: "o-1", externalId: "to-1" });
			const result = await controller.getLastSyncTime();
			expect(result).toBeInstanceOf(Date);
		});

		it("filters by entity type", async () => {
			await controller.syncMenu({ entityId: "p-1", externalId: "t-1" });
			await controller.syncOrder({ entityId: "o-1", externalId: "to-1" });
			const result = await controller.getLastSyncTime("menu-item");
			expect(result).toBeInstanceOf(Date);
		});
	});

	// ── Sync stats ───────────────────────────────────────────────────

	describe("getSyncStats", () => {
		it("returns all zeroes when no records exist", async () => {
			const stats = await controller.getSyncStats();
			expect(stats.total).toBe(0);
			expect(stats.pending).toBe(0);
			expect(stats.synced).toBe(0);
			expect(stats.failed).toBe(0);
		});

		it("aggregates across entity types", async () => {
			await controller.syncMenu({ entityId: "p-1", externalId: "t-1" });
			await controller.syncMenu({ entityId: "p-2", externalId: "t-2" });
			await controller.syncOrder({ entityId: "o-1", externalId: "to-1" });
			await controller.syncInventory({
				entityId: "i-1",
				externalId: "ti-1",
			});

			const stats = await controller.getSyncStats();
			expect(stats.total).toBe(4);
			expect(stats.synced).toBe(4);
			expect(stats.byEntityType["menu-item"]).toBe(2);
			expect(stats.byEntityType.order).toBe(1);
			expect(stats.byEntityType.inventory).toBe(1);
		});
	});
});
