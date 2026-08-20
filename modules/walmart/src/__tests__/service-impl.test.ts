import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWalmartController } from "../service-impl";

describe("createWalmartController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createWalmartController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createWalmartController(mockData);
	});

	// ── createItem ─────────────────────────────────────────────────────────────

	describe("createItem", () => {
		it("creates an unpublished item with minimal fields", async () => {
			const item = await controller.createItem({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Test Product",
				price: 19.99,
			});

			expect(item.id).toBeDefined();
			expect(item.localProductId).toBe("prod-1");
			expect(item.sku).toBe("SKU-001");
			expect(item.title).toBe("Test Product");
			expect(item.status).toBe("unpublished");
			expect(item.lifecycleStatus).toBe("active");
			expect(item.price).toBe(19.99);
			expect(item.quantity).toBe(0);
			expect(item.fulfillmentType).toBe("seller");
			expect(item.createdAt).toBeInstanceOf(Date);
		});

		it("creates an item with all optional fields", async () => {
			const item = await controller.createItem({
				localProductId: "prod-2",
				sku: "SKU-002",
				title: "Full Product",
				price: 49.99,
				quantity: 100,
				upc: "012345678901",
				gtin: "00012345678905",
				brand: "TestBrand",
				category: "Electronics",
				fulfillmentType: "wfs",
			});

			expect(item.upc).toBe("012345678901");
			expect(item.gtin).toBe("00012345678905");
			expect(item.brand).toBe("TestBrand");
			expect(item.category).toBe("Electronics");
			expect(item.fulfillmentType).toBe("wfs");
			expect(item.quantity).toBe(100);
		});

		it("creates an item with metadata", async () => {
			const item = await controller.createItem({
				localProductId: "prod-3",
				sku: "SKU-003",
				title: "Meta Product",
				price: 10,
				metadata: { size: "large" },
			});

			expect(item.metadata).toEqual({ size: "large" });
		});
	});

	// ── updateItem ─────────────────────────────────────────────────────────────

	describe("updateItem", () => {
		it("updates item title and price", async () => {
			const item = await controller.createItem({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Original",
				price: 10,
			});

			const updated = await controller.updateItem(item.id, {
				title: "Updated",
				price: 20,
			});

			expect(updated?.title).toBe("Updated");
			expect(updated?.price).toBe(20);
		});

		it("returns null for non-existent item", async () => {
			const result = await controller.updateItem("non-existent", {
				title: "Test",
			});
			expect(result).toBeNull();
		});

		it("updates item status to published", async () => {
			const item = await controller.createItem({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Item",
				price: 10,
			});

			const updated = await controller.updateItem(item.id, {
				status: "published",
			});

			expect(updated?.status).toBe("published");
		});

		it("updates walmartItemId on sync", async () => {
			const item = await controller.createItem({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Item",
				price: 10,
			});

			const updated = await controller.updateItem(item.id, {
				walmartItemId: "WM-12345",
			});

			expect(updated?.walmartItemId).toBe("WM-12345");
		});

		it("updates fulfillment type", async () => {
			const item = await controller.createItem({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Item",
				price: 10,
			});

			const updated = await controller.updateItem(item.id, {
				fulfillmentType: "wfs",
			});

			expect(updated?.fulfillmentType).toBe("wfs");
		});
	});

	// ── retireItem ─────────────────────────────────────────────────────────────

	describe("retireItem", () => {
		it("retires an item", async () => {
			const item = await controller.createItem({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Item",
				price: 10,
			});

			const retired = await controller.retireItem(item.id);

			expect(retired?.status).toBe("retired");
			expect(retired?.lifecycleStatus).toBe("archived");
		});

		it("returns null for non-existent item", async () => {
			const result = await controller.retireItem("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── getItem ────────────────────────────────────────────────────────────────

	describe("getItem", () => {
		it("returns an item by id", async () => {
			const item = await controller.createItem({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Item",
				price: 10,
			});

			const found = await controller.getItem(item.id);
			expect(found?.id as string).toBe(item.id);
		});

		it("returns null for non-existent item", async () => {
			const result = await controller.getItem("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── getItemByProduct ───────────────────────────────────────────────────────

	describe("getItemByProduct", () => {
		it("finds an item by product id", async () => {
			await controller.createItem({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Item",
				price: 10,
			});

			const found = await controller.getItemByProduct("prod-1");
			expect(found?.localProductId).toBe("prod-1");
		});

		it("returns null when no item exists for product", async () => {
			const result = await controller.getItemByProduct("unknown");
			expect(result).toBeNull();
		});
	});

	// ── listItems ──────────────────────────────────────────────────────────────

	describe("listItems", () => {
		it("returns all items", async () => {
			await controller.createItem({
				localProductId: "p1",
				sku: "S1",
				title: "A",
				price: 10,
			});
			await controller.createItem({
				localProductId: "p2",
				sku: "S2",
				title: "B",
				price: 20,
			});

			const items = await controller.listItems();
			expect(items).toHaveLength(2);
		});

		it("filters items by status", async () => {
			const item = await controller.createItem({
				localProductId: "p1",
				sku: "S1",
				title: "A",
				price: 10,
			});
			await controller.updateItem(item.id, { status: "published" });

			const published = await controller.listItems({
				status: "published",
			});
			expect(published).toHaveLength(1);
		});
	});

	// ── submitFeed ─────────────────────────────────────────────────────────────

	describe("submitFeed", () => {
		it("creates a pending feed submission", async () => {
			const feed = await controller.submitFeed("item");

			expect(feed.id).toBeDefined();
			expect(feed.feedType).toBe("item");
			expect(feed.status).toBe("pending");
			expect(feed.totalItems).toBe(0);
			expect(feed.submittedAt).toBeInstanceOf(Date);
		});

		it("creates feeds of different types", async () => {
			const itemFeed = await controller.submitFeed("item");
			const inventoryFeed = await controller.submitFeed("inventory");

			expect(itemFeed.feedType).toBe("item");
			expect(inventoryFeed.feedType).toBe("inventory");
		});
	});

	// ── getLastFeed ────────────────────────────────────────────────────────────

	describe("getLastFeed", () => {
		it("returns a feed of the given type", async () => {
			await controller.submitFeed("item");
			await controller.submitFeed("item");

			const last = await controller.getLastFeed("item");
			expect(last).not.toBeNull();
			expect(last?.feedType).toBe("item");
		});

		it("returns null when no feeds exist for type", async () => {
			const result = await controller.getLastFeed("price");
			expect(result).toBeNull();
		});
	});

	// ── listFeeds ──────────────────────────────────────────────────────────────

	describe("listFeeds", () => {
		it("returns all feeds", async () => {
			await controller.submitFeed("item");
			await controller.submitFeed("inventory");

			const feeds = await controller.listFeeds();
			expect(feeds).toHaveLength(2);
		});
	});

	// ── receiveOrder ───────────────────────────────────────────────────────────

	describe("receiveOrder", () => {
		it("creates a new order", async () => {
			const order = await controller.receiveOrder({
				purchaseOrderId: "PO-001",
				items: [{ sku: "SKU-1", qty: 2 }],
				orderTotal: 39.98,
				shippingTotal: 5.0,
				walmartFee: 3.0,
				tax: 2.5,
				customerName: "Jane Doe",
			});

			expect(order.id).toBeDefined();
			expect(order.purchaseOrderId).toBe("PO-001");
			expect(order.status).toBe("created");
			expect(order.orderTotal).toBe(39.98);
			expect(order.customerName).toBe("Jane Doe");
		});

		it("creates an order with minimal fields", async () => {
			const order = await controller.receiveOrder({
				purchaseOrderId: "PO-002",
				items: [],
				orderTotal: 10,
				shippingTotal: 0,
				walmartFee: 1,
				tax: 0.5,
			});

			expect(order.customerName).toBeUndefined();
			expect(order.shippingAddress).toEqual({});
		});
	});

	// ── acknowledgeOrder ───────────────────────────────────────────────────────

	describe("acknowledgeOrder", () => {
		it("acknowledges an order", async () => {
			const order = await controller.receiveOrder({
				purchaseOrderId: "PO-001",
				items: [],
				orderTotal: 10,
				shippingTotal: 0,
				walmartFee: 1,
				tax: 0.5,
			});

			const acknowledged = await controller.acknowledgeOrder(order.id);
			expect(acknowledged?.status).toBe("acknowledged");
		});

		it("returns null for non-existent order", async () => {
			const result = await controller.acknowledgeOrder("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── shipOrder ──────────────────────────────────────────────────────────────

	describe("shipOrder", () => {
		it("marks order as shipped", async () => {
			const order = await controller.receiveOrder({
				purchaseOrderId: "PO-001",
				items: [],
				orderTotal: 10,
				shippingTotal: 5,
				walmartFee: 1,
				tax: 0.5,
			});

			const shipped = await controller.shipOrder(order.id, "TRACK123", "FedEx");

			expect(shipped?.status).toBe("shipped");
			expect(shipped?.trackingNumber).toBe("TRACK123");
			expect(shipped?.carrier).toBe("FedEx");
			expect(shipped?.shipDate).toBeInstanceOf(Date);
		});

		it("returns null for non-existent order", async () => {
			const result = await controller.shipOrder("non-existent", "TRACK", "UPS");
			expect(result).toBeNull();
		});
	});

	// ── cancelOrder ────────────────────────────────────────────────────────────

	describe("cancelOrder", () => {
		it("cancels an order", async () => {
			const order = await controller.receiveOrder({
				purchaseOrderId: "PO-001",
				items: [],
				orderTotal: 10,
				shippingTotal: 0,
				walmartFee: 1,
				tax: 0.5,
			});

			const cancelled = await controller.cancelOrder(order.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("returns null for non-existent order", async () => {
			const result = await controller.cancelOrder("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── listOrders ─────────────────────────────────────────────────────────────

	describe("listOrders", () => {
		it("returns all orders", async () => {
			await controller.receiveOrder({
				purchaseOrderId: "PO-1",
				items: [],
				orderTotal: 10,
				shippingTotal: 0,
				walmartFee: 1,
				tax: 0.5,
			});
			await controller.receiveOrder({
				purchaseOrderId: "PO-2",
				items: [],
				orderTotal: 20,
				shippingTotal: 0,
				walmartFee: 2,
				tax: 1,
			});

			const orders = await controller.listOrders();
			expect(orders).toHaveLength(2);
		});
	});

	// ── getChannelStats ────────────────────────────────────────────────────────

	describe("getChannelStats", () => {
		it("returns empty stats when no data", async () => {
			const stats = await controller.getChannelStats();

			expect(stats.totalItems).toBe(0);
			expect(stats.publishedItems).toBe(0);
			expect(stats.totalOrders).toBe(0);
			expect(stats.totalRevenue).toBe(0);
			expect(stats.pendingFeeds).toBe(0);
			expect(stats.errorItems).toBe(0);
		});

		it("computes stats from items, orders, and feeds", async () => {
			const item = await controller.createItem({
				localProductId: "p1",
				sku: "S1",
				title: "A",
				price: 25,
			});
			await controller.updateItem(item.id, { status: "published" });

			await controller.receiveOrder({
				purchaseOrderId: "PO-1",
				items: [],
				orderTotal: 50,
				shippingTotal: 5,
				walmartFee: 3,
				tax: 2,
			});

			await controller.submitFeed("item");

			const stats = await controller.getChannelStats();
			expect(stats.totalItems).toBe(1);
			expect(stats.publishedItems).toBe(1);
			expect(stats.totalOrders).toBe(1);
			expect(stats.totalRevenue).toBe(50);
			expect(stats.pendingFeeds).toBe(1);
		});
	});

	// ── getItemHealth ──────────────────────────────────────────────────────────

	describe("getItemHealth", () => {
		it("returns empty health when no items", async () => {
			const health = await controller.getItemHealth();

			expect(health.total).toBe(0);
			expect(health.published).toBe(0);
			expect(health.unpublished).toBe(0);
		});

		it("computes health breakdown", async () => {
			const i1 = await controller.createItem({
				localProductId: "p1",
				sku: "S1",
				title: "A",
				price: 10,
			});
			await controller.updateItem(i1.id, { status: "published" });

			await controller.createItem({
				localProductId: "p2",
				sku: "S2",
				title: "B",
				price: 20,
				fulfillmentType: "wfs",
			});

			const health = await controller.getItemHealth();
			expect(health.total).toBe(2);
			expect(health.published).toBe(1);
			expect(health.unpublished).toBe(1);
			expect(health.sellerFulfilled).toBe(1);
			expect(health.wfsFulfilled).toBe(1);
		});
	});
});
