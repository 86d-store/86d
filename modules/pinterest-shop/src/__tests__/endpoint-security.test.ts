import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPinterestShopController } from "../service-impl";

describe("pinterest-shop endpoint security", () => {
	let mockDataA: ReturnType<typeof createMockDataService>;
	let mockDataB: ReturnType<typeof createMockDataService>;
	let controllerA: ReturnType<typeof createPinterestShopController>;
	let controllerB: ReturnType<typeof createPinterestShopController>;

	beforeEach(() => {
		mockDataA = createMockDataService();
		mockDataB = createMockDataService();
		controllerA = createPinterestShopController(mockDataA);
		controllerB = createPinterestShopController(mockDataB);
	});

	// ── Data isolation ─────────────────────────────────────────────────

	describe("data isolation", () => {
		it("catalog items created in store A are not visible in store B", async () => {
			await controllerA.createCatalogItem({
				localProductId: "prod-1",
				title: "Blue Vase",
				link: "https://example.com/blue-vase",
				imageUrl: "https://example.com/blue-vase.jpg",
				price: 45,
			});
			const itemsB = await controllerB.listCatalogItems();
			expect(itemsB).toHaveLength(0);
		});

		it("catalog items created in store B are not visible in store A", async () => {
			await controllerB.createCatalogItem({
				localProductId: "prod-1",
				title: "Red Vase",
				link: "https://example.com/red-vase",
				imageUrl: "https://example.com/red-vase.jpg",
				price: 50,
			});
			const itemsA = await controllerA.listCatalogItems();
			expect(itemsA).toHaveLength(0);
		});

		it("store A cannot retrieve a catalog item created in store B by id", async () => {
			const item = await controllerB.createCatalogItem({
				localProductId: "prod-2",
				title: "Green Vase",
				link: "https://example.com/green-vase",
				imageUrl: "https://example.com/green-vase.jpg",
				price: 55,
			});
			const result = await controllerA.getCatalogItem(item.id);
			expect(result).toBeNull();
		});

		it("store A cannot update a catalog item owned by store B", async () => {
			const item = await controllerB.createCatalogItem({
				localProductId: "prod-3",
				title: "Purple Vase",
				link: "https://example.com/purple-vase",
				imageUrl: "https://example.com/purple-vase.jpg",
				price: 60,
			});
			const result = await controllerA.updateCatalogItem(item.id, {
				price: 5,
			});
			expect(result).toBeNull();
		});

		it("store A cannot delete a catalog item owned by store B", async () => {
			const item = await controllerB.createCatalogItem({
				localProductId: "prod-4",
				title: "Yellow Vase",
				link: "https://example.com/yellow-vase",
				imageUrl: "https://example.com/yellow-vase.jpg",
				price: 65,
			});
			const deleted = await controllerA.deleteCatalogItem(item.id);
			expect(deleted).toBe(false);
			// Item still accessible in store B
			const stillExists = await controllerB.getCatalogItem(item.id);
			expect(stillExists).not.toBeNull();
		});

		it("pins created in store A are not visible in store B", async () => {
			const item = await controllerA.createCatalogItem({
				localProductId: "prod-5",
				title: "Pin Base Item",
				link: "https://example.com/pin-base",
				imageUrl: "https://example.com/pin-base.jpg",
				price: 30,
			});
			await controllerA.createPin({
				catalogItemId: item.id,
				title: "Pin A",
				link: "https://example.com/pin-a",
				imageUrl: "https://example.com/pin-a.jpg",
			});
			const pinsB = await controllerB.listPins();
			expect(pinsB).toHaveLength(0);
		});

		it("store A cannot retrieve a pin owned by store B", async () => {
			const item = await controllerB.createCatalogItem({
				localProductId: "prod-6",
				title: "Pin Base B",
				link: "https://example.com/b",
				imageUrl: "https://example.com/b.jpg",
				price: 20,
			});
			const pin = await controllerB.createPin({
				catalogItemId: item.id,
				title: "Pin B",
				link: "https://example.com/pin-b",
				imageUrl: "https://example.com/pin-b.jpg",
			});
			const result = await controllerA.getPin(pin.id);
			expect(result).toBeNull();
		});

		it("channel stats in store A do not reflect store B data", async () => {
			await controllerB.createCatalogItem({
				localProductId: "prod-7",
				title: "B Item",
				link: "https://example.com/b-item",
				imageUrl: "https://example.com/b-item.jpg",
				price: 100,
			});
			const statsA = await controllerA.getChannelStats();
			expect(statsA.totalCatalogItems).toBe(0);
			expect(statsA.activeCatalogItems).toBe(0);
			expect(statsA.totalPins).toBe(0);
		});

		it("catalog item counts are isolated per store", async () => {
			await controllerA.createCatalogItem({
				localProductId: "prod-a1",
				title: "A Item 1",
				link: "https://example.com/a1",
				imageUrl: "https://example.com/a1.jpg",
				price: 10,
			});
			await controllerA.createCatalogItem({
				localProductId: "prod-a2",
				title: "A Item 2",
				link: "https://example.com/a2",
				imageUrl: "https://example.com/a2.jpg",
				price: 20,
			});
			await controllerB.createCatalogItem({
				localProductId: "prod-a1",
				title: "B Item 1",
				link: "https://example.com/b1",
				imageUrl: "https://example.com/b1.jpg",
				price: 10,
			});
			const itemsA = await controllerA.listCatalogItems();
			const itemsB = await controllerB.listCatalogItems();
			expect(itemsA).toHaveLength(2);
			expect(itemsB).toHaveLength(1);
		});

		it("getCatalogItemByProduct does not cross store boundaries", async () => {
			await controllerB.createCatalogItem({
				localProductId: "shared-prod",
				title: "Shared Product",
				link: "https://example.com/shared",
				imageUrl: "https://example.com/shared.jpg",
				price: 15,
			});
			const result = await controllerA.getCatalogItemByProduct("shared-prod");
			expect(result).toBeNull();
		});
	});

	// ── Resource immutability after deletion ───────────────────────────

	describe("resource immutability after deletion", () => {
		it("deleted catalog item cannot be retrieved by id", async () => {
			const item = await controllerA.createCatalogItem({
				localProductId: "prod-del-1",
				title: "To Delete",
				link: "https://example.com/del",
				imageUrl: "https://example.com/del.jpg",
				price: 9.99,
			});
			await controllerA.deleteCatalogItem(item.id);
			const result = await controllerA.getCatalogItem(item.id);
			expect(result).toBeNull();
		});

		it("deleted catalog item does not appear in listCatalogItems", async () => {
			const item = await controllerA.createCatalogItem({
				localProductId: "prod-del-2",
				title: "To Delete 2",
				link: "https://example.com/del2",
				imageUrl: "https://example.com/del2.jpg",
				price: 19.99,
			});
			await controllerA.createCatalogItem({
				localProductId: "prod-keep-1",
				title: "Keep Me",
				link: "https://example.com/keep",
				imageUrl: "https://example.com/keep.jpg",
				price: 29.99,
			});
			await controllerA.deleteCatalogItem(item.id);
			const items = await controllerA.listCatalogItems();
			expect(items).toHaveLength(1);
			expect(items[0]?.localProductId).toBe("prod-keep-1");
		});

		it("deleted catalog item cannot be updated", async () => {
			const item = await controllerA.createCatalogItem({
				localProductId: "prod-del-3",
				title: "Will Be Deleted",
				link: "https://example.com/del3",
				imageUrl: "https://example.com/del3.jpg",
				price: 9.99,
			});
			await controllerA.deleteCatalogItem(item.id);
			const result = await controllerA.updateCatalogItem(item.id, {
				price: 1,
			});
			expect(result).toBeNull();
		});

		it("deleting the same catalog item twice returns false the second time", async () => {
			const item = await controllerA.createCatalogItem({
				localProductId: "prod-del-4",
				title: "Double Delete",
				link: "https://example.com/del4",
				imageUrl: "https://example.com/del4.jpg",
				price: 5,
			});
			const first = await controllerA.deleteCatalogItem(item.id);
			const second = await controllerA.deleteCatalogItem(item.id);
			expect(first).toBe(true);
			expect(second).toBe(false);
		});

		it("deleted catalog item is not returned by getCatalogItemByProduct", async () => {
			const item = await controllerA.createCatalogItem({
				localProductId: "prod-del-5",
				title: "Ghost Item",
				link: "https://example.com/ghost",
				imageUrl: "https://example.com/ghost.jpg",
				price: 12,
			});
			await controllerA.deleteCatalogItem(item.id);
			const result = await controllerA.getCatalogItemByProduct("prod-del-5");
			expect(result).toBeNull();
		});

		it("channel stats exclude deleted catalog items", async () => {
			const item = await controllerA.createCatalogItem({
				localProductId: "prod-del-6",
				title: "Stat Ghost",
				link: "https://example.com/stat-ghost",
				imageUrl: "https://example.com/stat-ghost.jpg",
				price: 20,
			});
			const statsBefore = await controllerA.getChannelStats();
			await controllerA.deleteCatalogItem(item.id);
			const statsAfter = await controllerA.getChannelStats();
			expect(statsAfter.totalCatalogItems).toBe(
				statsBefore.totalCatalogItems - 1,
			);
		});
	});

	// ── Stats isolation ────────────────────────────────────────────────

	describe("stats isolation", () => {
		it("getChannelStats activeCatalogItems reflects only own store active items", async () => {
			await controllerA.createCatalogItem({
				localProductId: "stat-active-a",
				title: "Active A",
				link: "https://example.com/active-a",
				imageUrl: "https://example.com/active-a.jpg",
				price: 40,
			});
			// Store B has two active items
			await controllerB.createCatalogItem({
				localProductId: "stat-active-b1",
				title: "Active B1",
				link: "https://example.com/b1",
				imageUrl: "https://example.com/b1.jpg",
				price: 40,
			});
			await controllerB.createCatalogItem({
				localProductId: "stat-active-b2",
				title: "Active B2",
				link: "https://example.com/b2",
				imageUrl: "https://example.com/b2.jpg",
				price: 40,
			});
			const statsA = await controllerA.getChannelStats();
			// Store A has 1 item (default active status)
			expect(statsA.activeCatalogItems).toBe(1);
		});

		it("getChannelStats totalPins counts only own store pins", async () => {
			const itemA = await controllerA.createCatalogItem({
				localProductId: "stat-pin-a",
				title: "Pin Base A",
				link: "https://example.com/pin-a",
				imageUrl: "https://example.com/pin-a.jpg",
				price: 30,
			});
			await controllerA.createPin({
				catalogItemId: itemA.id,
				title: "Pin 1",
				link: "https://example.com/p1",
				imageUrl: "https://example.com/p1.jpg",
			});
			const itemB = await controllerB.createCatalogItem({
				localProductId: "stat-pin-b",
				title: "Pin Base B",
				link: "https://example.com/pin-b",
				imageUrl: "https://example.com/pin-b.jpg",
				price: 30,
			});
			await controllerB.createPin({
				catalogItemId: itemB.id,
				title: "B Pin 1",
				link: "https://example.com/bp1",
				imageUrl: "https://example.com/bp1.jpg",
			});
			await controllerB.createPin({
				catalogItemId: itemB.id,
				title: "B Pin 2",
				link: "https://example.com/bp2",
				imageUrl: "https://example.com/bp2.jpg",
			});
			const statsA = await controllerA.getChannelStats();
			expect(statsA.totalPins).toBe(1);
		});

		it("getChannelStats returns zero values for empty store", async () => {
			const stats = await controllerA.getChannelStats();
			expect(stats.totalCatalogItems).toBe(0);
			expect(stats.activeCatalogItems).toBe(0);
			expect(stats.totalPins).toBe(0);
			expect(stats.totalImpressions).toBe(0);
			expect(stats.totalClicks).toBe(0);
			expect(stats.totalSaves).toBe(0);
		});
	});

	// ── Graceful failures for invalid IDs ─────────────────────────────

	describe("graceful failures", () => {
		it("getCatalogItem returns null for non-existent id", async () => {
			const result = await controllerA.getCatalogItem("does-not-exist");
			expect(result).toBeNull();
		});

		it("getCatalogItemByProduct returns null for non-existent product", async () => {
			const result =
				await controllerA.getCatalogItemByProduct("no-such-product");
			expect(result).toBeNull();
		});

		it("updateCatalogItem returns null for non-existent id", async () => {
			const result = await controllerA.updateCatalogItem("ghost-id", {
				price: 5,
			});
			expect(result).toBeNull();
		});

		it("deleteCatalogItem returns false for non-existent id", async () => {
			const result = await controllerA.deleteCatalogItem("ghost-id");
			expect(result).toBe(false);
		});

		it("getPin returns null for non-existent id", async () => {
			const result = await controllerA.getPin("ghost-pin-id");
			expect(result).toBeNull();
		});

		it("getPinAnalytics returns null for non-existent pin", async () => {
			const result = await controllerA.getPinAnalytics("ghost-pin-id");
			expect(result).toBeNull();
		});

		it("getLastSync returns null when no sync has run", async () => {
			const result = await controllerA.getLastSync();
			expect(result).toBeNull();
		});

		it("listCatalogItems returns empty array for empty store", async () => {
			const items = await controllerA.listCatalogItems();
			expect(items).toHaveLength(0);
		});

		it("listPins returns empty array for empty store", async () => {
			const pins = await controllerA.listPins();
			expect(pins).toHaveLength(0);
		});

		it("listSyncs returns empty array for empty store", async () => {
			const syncs = await controllerA.listSyncs();
			expect(syncs).toHaveLength(0);
		});
	});
});
