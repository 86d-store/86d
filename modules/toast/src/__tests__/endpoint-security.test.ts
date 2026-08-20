import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createToastController } from "../service-impl";

describe("toast endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createToastController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createToastController(mockData);
	});

	describe("sync record safety", () => {
		it("get sync record returns null for non-existent id", async () => {
			const result = await controller.getSyncRecord("nonexistent");
			expect(result).toBeNull();
		});

		it("listing with invalid entity type returns empty", async () => {
			await controller.syncMenu({ entityId: "p-1", externalId: "t-1" });
			const result = await controller.listSyncRecords({
				entityType: "order",
			});
			expect(result).toHaveLength(0);
		});
	});

	describe("menu mapping safety", () => {
		it("get mapping returns null for non-existent id", async () => {
			const result = await controller.getMenuMapping("nonexistent");
			expect(result).toBeNull();
		});

		it("delete non-existent mapping returns false", async () => {
			const result = await controller.deleteMenuMapping("nonexistent");
			expect(result).toBe(false);
		});

		it("double delete returns false on second attempt", async () => {
			const mapping = await controller.createMenuMapping({
				localProductId: "p-1",
				externalMenuItemId: "t-1",
			});
			expect(await controller.deleteMenuMapping(mapping.id)).toBe(true);
			expect(await controller.deleteMenuMapping(mapping.id)).toBe(false);
		});
	});

	describe("stats accuracy", () => {
		it("stats reflect current state after operations", async () => {
			await controller.syncMenu({ entityId: "p-1", externalId: "t-1" });
			await controller.syncOrder({ entityId: "o-1", externalId: "to-1" });

			const stats = await controller.getSyncStats();
			expect(stats.total).toBe(2);
			expect(stats.synced).toBe(2);
		});
	});
});
