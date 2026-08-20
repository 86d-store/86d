import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPinterestShopController } from "../service-impl";

describe("createPinterestShopController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPinterestShopController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createPinterestShopController(mockData);
	});

	// ── createCatalogItem ──────────────────────────────────────────────────────

	describe("createCatalogItem", () => {
		it("creates an active catalog item with minimal fields", async () => {
			const item = await controller.createCatalogItem({
				localProductId: "prod-1",
				title: "Test Product",
				link: "https://example.com/product/1",
				imageUrl: "https://example.com/img/1.jpg",
				price: 29.99,
			});

			expect(item.id).toBeDefined();
			expect(item.localProductId).toBe("prod-1");
			expect(item.title).toBe("Test Product");
			expect(item.status).toBe("active");
			expect(item.price).toBe(29.99);
			expect(item.availability).toBe("in-stock");
			expect(item.createdAt).toBeInstanceOf(Date);
		});

		it("creates a catalog item with all optional fields", async () => {
			const item = await controller.createCatalogItem({
				localProductId: "prod-2",
				title: "Full Product",
				link: "https://example.com/product/2",
				imageUrl: "https://example.com/img/2.jpg",
				price: 49.99,
				description: "A great product",
				salePrice: 39.99,
				availability: "preorder",
				googleCategory: "Apparel & Accessories",
			});

			expect(item.description).toBe("A great product");
			expect(item.salePrice).toBe(39.99);
			expect(item.availability).toBe("preorder");
			expect(item.googleCategory).toBe("Apparel & Accessories");
		});
	});

	// ── updateCatalogItem ──────────────────────────────────────────────────────

	describe("updateCatalogItem", () => {
		it("updates catalog item title and price", async () => {
			const item = await controller.createCatalogItem({
				localProductId: "prod-1",
				title: "Original",
				link: "https://example.com/1",
				imageUrl: "https://example.com/img/1.jpg",
				price: 10,
			});

			const updated = await controller.updateCatalogItem(item.id, {
				title: "Updated",
				price: 20,
			});

			expect(updated?.title).toBe("Updated");
			expect(updated?.price).toBe(20);
		});

		it("returns null for non-existent item", async () => {
			const result = await controller.updateCatalogItem("non-existent", {
				title: "Test",
			});
			expect(result).toBeNull();
		});

		it("updates status to disapproved", async () => {
			const item = await controller.createCatalogItem({
				localProductId: "prod-1",
				title: "Item",
				link: "https://example.com/1",
				imageUrl: "https://example.com/img/1.jpg",
				price: 10,
			});

			const updated = await controller.updateCatalogItem(item.id, {
				status: "disapproved",
			});

			expect(updated?.status).toBe("disapproved");
		});

		it("updates pinterestItemId on sync", async () => {
			const item = await controller.createCatalogItem({
				localProductId: "prod-1",
				title: "Item",
				link: "https://example.com/1",
				imageUrl: "https://example.com/img/1.jpg",
				price: 10,
			});

			const updated = await controller.updateCatalogItem(item.id, {
				pinterestItemId: "pin-item-123",
			});

			expect(updated?.pinterestItemId).toBe("pin-item-123");
		});
	});

	// ── deleteCatalogItem ──────────────────────────────────────────────────────

	describe("deleteCatalogItem", () => {
		it("deletes an existing catalog item", async () => {
			const item = await controller.createCatalogItem({
				localProductId: "prod-1",
				title: "Item",
				link: "https://example.com/1",
				imageUrl: "https://example.com/img/1.jpg",
				price: 10,
			});

			const deleted = await controller.deleteCatalogItem(item.id);
			expect(deleted).toBe(true);

			const found = await controller.getCatalogItem(item.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent item", async () => {
			const result = await controller.deleteCatalogItem("non-existent");
			expect(result).toBe(false);
		});
	});

	// ── getCatalogItem ─────────────────────────────────────────────────────────

	describe("getCatalogItem", () => {
		it("returns a catalog item by id", async () => {
			const item = await controller.createCatalogItem({
				localProductId: "prod-1",
				title: "Item",
				link: "https://example.com/1",
				imageUrl: "https://example.com/img/1.jpg",
				price: 10,
			});

			const found = await controller.getCatalogItem(item.id);
			expect(found?.id as string).toBe(item.id);
		});

		it("returns null for non-existent item", async () => {
			const result = await controller.getCatalogItem("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── getCatalogItemByProduct ────────────────────────────────────────────────

	describe("getCatalogItemByProduct", () => {
		it("finds a catalog item by product id", async () => {
			await controller.createCatalogItem({
				localProductId: "prod-1",
				title: "Item",
				link: "https://example.com/1",
				imageUrl: "https://example.com/img/1.jpg",
				price: 10,
			});

			const found = await controller.getCatalogItemByProduct("prod-1");
			expect(found?.localProductId).toBe("prod-1");
		});

		it("returns null when no item exists for product", async () => {
			const result = await controller.getCatalogItemByProduct("unknown");
			expect(result).toBeNull();
		});
	});

	// ── listCatalogItems ───────────────────────────────────────────────────────

	describe("listCatalogItems", () => {
		it("returns all catalog items", async () => {
			await controller.createCatalogItem({
				localProductId: "p1",
				title: "A",
				link: "https://example.com/1",
				imageUrl: "https://example.com/img/1.jpg",
				price: 10,
			});
			await controller.createCatalogItem({
				localProductId: "p2",
				title: "B",
				link: "https://example.com/2",
				imageUrl: "https://example.com/img/2.jpg",
				price: 20,
			});

			const items = await controller.listCatalogItems();
			expect(items).toHaveLength(2);
		});

		it("filters by status", async () => {
			const item = await controller.createCatalogItem({
				localProductId: "p1",
				title: "A",
				link: "https://example.com/1",
				imageUrl: "https://example.com/img/1.jpg",
				price: 10,
			});
			await controller.updateCatalogItem(item.id, {
				status: "inactive",
			});

			const inactive = await controller.listCatalogItems({
				status: "inactive",
			});
			expect(inactive).toHaveLength(1);
		});

		it("paginates with take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createCatalogItem({
					localProductId: `p-${i}`,
					title: `Item ${i}`,
					link: `https://example.com/${i}`,
					imageUrl: `https://example.com/img/${i}.jpg`,
					price: 10 + i,
				});
			}

			const page = await controller.listCatalogItems({
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── syncCatalog ────────────────────────────────────────────────────────────

	describe("syncCatalog", () => {
		it("creates a synced catalog sync record", async () => {
			await controller.createCatalogItem({
				localProductId: "p1",
				title: "A",
				link: "https://example.com/1",
				imageUrl: "https://example.com/img/1.jpg",
				price: 10,
			});

			const sync = await controller.syncCatalog();

			expect(sync.id).toBeDefined();
			expect(sync.status).toBe("synced");
			expect(sync.totalItems).toBe(1);
			expect(sync.syncedItems).toBe(1);
			expect(sync.failedItems).toBe(0);
			expect(sync.startedAt).toBeInstanceOf(Date);
			expect(sync.completedAt).toBeInstanceOf(Date);
		});

		it("syncs with zero items when catalog is empty", async () => {
			const sync = await controller.syncCatalog();

			expect(sync.totalItems).toBe(0);
			expect(sync.syncedItems).toBe(0);
			expect(sync.status).toBe("synced");
		});
	});

	// ── getLastSync ────────────────────────────────────────────────────────────

	describe("getLastSync", () => {
		it("returns a sync record", async () => {
			await controller.syncCatalog();
			await controller.syncCatalog();

			const last = await controller.getLastSync();
			expect(last).not.toBeNull();
			expect(last?.status).toBe("synced");
		});

		it("returns null when no syncs exist", async () => {
			const result = await controller.getLastSync();
			expect(result).toBeNull();
		});
	});

	// ── listSyncs ──────────────────────────────────────────────────────────────

	describe("listSyncs", () => {
		it("returns all syncs", async () => {
			await controller.syncCatalog();
			await controller.syncCatalog();

			const syncs = await controller.listSyncs();
			expect(syncs).toHaveLength(2);
		});
	});

	// ── createPin ──────────────────────────────────────────────────────────────

	describe("createPin", () => {
		it("creates a shopping pin", async () => {
			const pin = await controller.createPin({
				catalogItemId: "item-1",
				title: "Shop this look",
				link: "https://example.com/product/1",
				imageUrl: "https://example.com/img/1.jpg",
			});

			expect(pin.id).toBeDefined();
			expect(pin.catalogItemId).toBe("item-1");
			expect(pin.title).toBe("Shop this look");
			expect(pin.impressions).toBe(0);
			expect(pin.saves).toBe(0);
			expect(pin.clicks).toBe(0);
			expect(pin.createdAt).toBeInstanceOf(Date);
		});

		it("creates a pin with optional fields", async () => {
			const pin = await controller.createPin({
				catalogItemId: "item-1",
				title: "Pin Title",
				link: "https://example.com/1",
				imageUrl: "https://example.com/img/1.jpg",
				description: "A great pin",
				boardId: "board-123",
			});

			expect(pin.description).toBe("A great pin");
			expect(pin.boardId).toBe("board-123");
		});
	});

	// ── getPin ─────────────────────────────────────────────────────────────────

	describe("getPin", () => {
		it("returns a pin by id", async () => {
			const pin = await controller.createPin({
				catalogItemId: "item-1",
				title: "Pin",
				link: "https://example.com/1",
				imageUrl: "https://example.com/img/1.jpg",
			});

			const found = await controller.getPin(pin.id);
			expect(found?.id as string).toBe(pin.id);
		});

		it("returns null for non-existent pin", async () => {
			const result = await controller.getPin("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── listPins ───────────────────────────────────────────────────────────────

	describe("listPins", () => {
		it("returns all pins", async () => {
			await controller.createPin({
				catalogItemId: "item-1",
				title: "Pin 1",
				link: "https://example.com/1",
				imageUrl: "https://example.com/img/1.jpg",
			});
			await controller.createPin({
				catalogItemId: "item-2",
				title: "Pin 2",
				link: "https://example.com/2",
				imageUrl: "https://example.com/img/2.jpg",
			});

			const pins = await controller.listPins();
			expect(pins).toHaveLength(2);
		});

		it("filters pins by catalogItemId", async () => {
			await controller.createPin({
				catalogItemId: "item-1",
				title: "Pin 1",
				link: "https://example.com/1",
				imageUrl: "https://example.com/img/1.jpg",
			});
			await controller.createPin({
				catalogItemId: "item-2",
				title: "Pin 2",
				link: "https://example.com/2",
				imageUrl: "https://example.com/img/2.jpg",
			});

			const pins = await controller.listPins({
				catalogItemId: "item-1",
			});
			expect(pins).toHaveLength(1);
		});
	});

	// ── getPinAnalytics ────────────────────────────────────────────────────────

	describe("getPinAnalytics", () => {
		it("returns analytics for a pin", async () => {
			const pin = await controller.createPin({
				catalogItemId: "item-1",
				title: "Pin",
				link: "https://example.com/1",
				imageUrl: "https://example.com/img/1.jpg",
			});

			const analytics = await controller.getPinAnalytics(pin.id);

			expect(analytics?.impressions).toBe(0);
			expect(analytics?.saves).toBe(0);
			expect(analytics?.clicks).toBe(0);
			expect(analytics?.clickRate).toBe(0);
			expect(analytics?.saveRate).toBe(0);
		});

		it("returns null for non-existent pin", async () => {
			const result = await controller.getPinAnalytics("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── getChannelStats ────────────────────────────────────────────────────────

	describe("getChannelStats", () => {
		it("returns empty stats when no data", async () => {
			const stats = await controller.getChannelStats();

			expect(stats.totalCatalogItems).toBe(0);
			expect(stats.activeCatalogItems).toBe(0);
			expect(stats.totalPins).toBe(0);
			expect(stats.totalImpressions).toBe(0);
			expect(stats.totalClicks).toBe(0);
			expect(stats.totalSaves).toBe(0);
		});

		it("computes stats from catalog items and pins", async () => {
			await controller.createCatalogItem({
				localProductId: "p1",
				title: "Item",
				link: "https://example.com/1",
				imageUrl: "https://example.com/img/1.jpg",
				price: 10,
			});

			await controller.createPin({
				catalogItemId: "item-1",
				title: "Pin",
				link: "https://example.com/1",
				imageUrl: "https://example.com/img/1.jpg",
			});

			const stats = await controller.getChannelStats();
			expect(stats.totalCatalogItems).toBe(1);
			expect(stats.activeCatalogItems).toBe(1);
			expect(stats.totalPins).toBe(1);
		});
	});
});
