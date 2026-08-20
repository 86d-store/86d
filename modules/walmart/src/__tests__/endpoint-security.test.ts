import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWalmartController } from "../service-impl";

describe("walmart endpoint security", () => {
	let mockDataA: ReturnType<typeof createMockDataService>;
	let mockDataB: ReturnType<typeof createMockDataService>;
	let controllerA: ReturnType<typeof createWalmartController>;
	let controllerB: ReturnType<typeof createWalmartController>;

	beforeEach(() => {
		mockDataA = createMockDataService();
		mockDataB = createMockDataService();
		controllerA = createWalmartController(mockDataA);
		controllerB = createWalmartController(mockDataB);
	});

	// ── Data isolation: items ──────────────────────────────────────────────

	describe("data isolation – items", () => {
		it("item created in store A is not visible in store B", async () => {
			await controllerA.createItem({
				localProductId: "prod-1",
				sku: "SKU-A-001",
				title: "Store A Item",
				price: 29.99,
			});

			const itemsB = await controllerB.listItems();
			expect(itemsB).toHaveLength(0);
		});

		it("item created in store B is not visible in store A", async () => {
			await controllerB.createItem({
				localProductId: "prod-1",
				sku: "SKU-B-001",
				title: "Store B Item",
				price: 19.99,
			});

			const itemsA = await controllerA.listItems();
			expect(itemsA).toHaveLength(0);
		});

		it("getItem does not return an item from another store", async () => {
			const itemA = await controllerA.createItem({
				localProductId: "prod-1",
				sku: "SKU-A-001",
				title: "Store A Item",
				price: 29.99,
			});

			const result = await controllerB.getItem(itemA.id);
			expect(result).toBeNull();
		});

		it("getItemByProduct does not cross store boundaries", async () => {
			await controllerA.createItem({
				localProductId: "prod-shared",
				sku: "SKU-A-001",
				title: "Store A Item",
				price: 29.99,
			});

			const result = await controllerB.getItemByProduct("prod-shared");
			expect(result).toBeNull();
		});

		it("multiple items in A do not appear in B", async () => {
			await controllerA.createItem({
				localProductId: "p1",
				sku: "SKU-001",
				title: "Item One",
				price: 10,
			});
			await controllerA.createItem({
				localProductId: "p2",
				sku: "SKU-002",
				title: "Item Two",
				price: 20,
			});

			const itemsB = await controllerB.listItems();
			expect(itemsB).toHaveLength(0);
		});

		it("updateItem in store A does not affect store B", async () => {
			const itemA = await controllerA.createItem({
				localProductId: "prod-1",
				sku: "SKU-A-001",
				title: "Original Title",
				price: 29.99,
			});
			await controllerA.updateItem(itemA.id, { title: "Updated Title" });

			const resultB = await controllerB.getItem(itemA.id);
			expect(resultB).toBeNull();
		});

		it("retireItem in store A does not affect store B", async () => {
			const itemA = await controllerA.createItem({
				localProductId: "prod-1",
				sku: "SKU-A-001",
				title: "Store A Item",
				price: 29.99,
			});

			const result = await controllerB.retireItem(itemA.id);
			expect(result).toBeNull();
		});
	});

	// ── Data isolation: orders ─────────────────────────────────────────────

	describe("data isolation – orders", () => {
		it("order received in store A is not visible in store B", async () => {
			await controllerA.receiveOrder({
				purchaseOrderId: "PO-A-001",
				items: [],
				orderTotal: 100,
				shippingTotal: 10,
				walmartFee: 5,
				tax: 8,
			});

			const ordersB = await controllerB.listOrders();
			expect(ordersB).toHaveLength(0);
		});

		it("acknowledgeOrder via wrong store returns null", async () => {
			const orderA = await controllerA.receiveOrder({
				purchaseOrderId: "PO-A-001",
				items: [],
				orderTotal: 100,
				shippingTotal: 10,
				walmartFee: 5,
				tax: 8,
			});

			const result = await controllerB.acknowledgeOrder(orderA.id);
			expect(result).toBeNull();
		});

		it("shipOrder via wrong store returns null", async () => {
			const orderA = await controllerA.receiveOrder({
				purchaseOrderId: "PO-A-001",
				items: [],
				orderTotal: 100,
				shippingTotal: 10,
				walmartFee: 5,
				tax: 8,
			});

			const result = await controllerB.shipOrder(orderA.id, "TRK001", "FedEx");
			expect(result).toBeNull();
		});

		it("cancelOrder via wrong store returns null", async () => {
			const orderA = await controllerA.receiveOrder({
				purchaseOrderId: "PO-A-001",
				items: [],
				orderTotal: 100,
				shippingTotal: 10,
				walmartFee: 5,
				tax: 8,
			});

			const result = await controllerB.cancelOrder(orderA.id);
			expect(result).toBeNull();
		});

		it("orders from both stores are independently countable", async () => {
			await controllerA.receiveOrder({
				purchaseOrderId: "PO-A-001",
				items: [],
				orderTotal: 100,
				shippingTotal: 10,
				walmartFee: 5,
				tax: 8,
			});
			await controllerA.receiveOrder({
				purchaseOrderId: "PO-A-002",
				items: [],
				orderTotal: 200,
				shippingTotal: 15,
				walmartFee: 8,
				tax: 16,
			});
			await controllerB.receiveOrder({
				purchaseOrderId: "PO-B-001",
				items: [],
				orderTotal: 50,
				shippingTotal: 5,
				walmartFee: 2,
				tax: 4,
			});

			expect(await controllerA.listOrders()).toHaveLength(2);
			expect(await controllerB.listOrders()).toHaveLength(1);
		});
	});

	// ── Data isolation: feeds ──────────────────────────────────────────────

	describe("data isolation – feed submissions", () => {
		it("feed submitted in store A is not visible in store B", async () => {
			await controllerA.submitFeed("item");

			const lastFeedB = await controllerB.getLastFeed("item");
			expect(lastFeedB).toBeNull();
		});

		it("listFeeds in store B returns empty when only store A has feeds", async () => {
			await controllerA.submitFeed("item");
			await controllerA.submitFeed("inventory");

			const feedsB = await controllerB.listFeeds();
			expect(feedsB).toHaveLength(0);
		});
	});

	// ── Data isolation: channel stats ──────────────────────────────────────

	describe("data isolation – channel stats", () => {
		it("stats from store A do not bleed into store B", async () => {
			await controllerA.createItem({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Item",
				price: 30,
			});
			await controllerA.receiveOrder({
				purchaseOrderId: "PO-A-001",
				items: [],
				orderTotal: 100,
				shippingTotal: 10,
				walmartFee: 5,
				tax: 8,
			});

			const statsB = await controllerB.getChannelStats();
			expect(statsB.totalItems).toBe(0);
			expect(statsB.totalOrders).toBe(0);
			expect(statsB.totalRevenue).toBe(0);
		});

		it("item health from store A does not bleed into store B", async () => {
			await controllerA.createItem({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Item A",
				price: 30,
			});

			const healthB = await controllerB.getItemHealth();
			expect(healthB.total).toBe(0);
			expect(healthB.unpublished).toBe(0);
		});

		it("each store maintains independent item health counts", async () => {
			await controllerA.createItem({
				localProductId: "p1",
				sku: "SKU-A-001",
				title: "Item A1",
				price: 30,
			});
			await controllerA.createItem({
				localProductId: "p2",
				sku: "SKU-A-002",
				title: "Item A2",
				price: 40,
			});
			await controllerB.createItem({
				localProductId: "p3",
				sku: "SKU-B-001",
				title: "Item B1",
				price: 20,
			});

			const healthA = await controllerA.getItemHealth();
			const healthB = await controllerB.getItemHealth();

			expect(healthA.total).toBe(2);
			expect(healthB.total).toBe(1);
		});
	});

	// ── State machine: order workflow ──────────────────────────────────────

	describe("state machine – order workflow", () => {
		it("acknowledgeOrder on non-existent order returns null", async () => {
			expect(await controllerA.acknowledgeOrder("ghost-id")).toBeNull();
		});

		it("shipOrder on non-existent order returns null", async () => {
			expect(
				await controllerA.shipOrder("ghost-id", "TRK001", "UPS"),
			).toBeNull();
		});

		it("cancelOrder on non-existent order returns null", async () => {
			expect(await controllerA.cancelOrder("ghost-id")).toBeNull();
		});

		it("cannot ship an order belonging to another store", async () => {
			const orderA = await controllerA.receiveOrder({
				purchaseOrderId: "PO-A-001",
				items: [],
				orderTotal: 100,
				shippingTotal: 10,
				walmartFee: 5,
				tax: 8,
			});
			await controllerA.acknowledgeOrder(orderA.id);

			const result = await controllerB.shipOrder(orderA.id, "TRK-CROSS", "UPS");
			expect(result).toBeNull();
		});

		it("cannot cancel an order belonging to another store", async () => {
			const orderA = await controllerA.receiveOrder({
				purchaseOrderId: "PO-A-001",
				items: [],
				orderTotal: 100,
				shippingTotal: 10,
				walmartFee: 5,
				tax: 8,
			});

			const result = await controllerB.cancelOrder(orderA.id);
			expect(result).toBeNull();
		});

		it("full order lifecycle completes within a single store", async () => {
			const order = await controllerA.receiveOrder({
				purchaseOrderId: "PO-A-001",
				items: [],
				orderTotal: 100,
				shippingTotal: 10,
				walmartFee: 5,
				tax: 8,
			});
			expect(order.status).toBe("created");

			const acknowledged = await controllerA.acknowledgeOrder(order.id);
			expect(acknowledged?.status).toBe("acknowledged");

			const shipped = await controllerA.shipOrder(order.id, "TRK001", "FedEx");
			expect(shipped?.status).toBe("shipped");
			expect(shipped?.trackingNumber).toBe("TRK001");
			expect(shipped?.carrier).toBe("FedEx");
		});
	});

	// ── Resource immutability: retireItem ──────────────────────────────────

	describe("resource immutability – retireItem", () => {
		it("retired item still retrievable via getItem", async () => {
			const item = await controllerA.createItem({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Item",
				price: 30,
			});

			const retired = await controllerA.retireItem(item.id);
			expect(retired?.status).toBe("retired");
			expect(retired?.lifecycleStatus).toBe("archived");

			const fetched = await controllerA.getItem(item.id);
			expect(fetched?.status).toBe("retired");
		});

		it("retireItem on non-existent item returns null", async () => {
			expect(await controllerA.retireItem("ghost-id")).toBeNull();
		});

		it("retired item appears in getItemHealth retired count", async () => {
			const item = await controllerA.createItem({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Item",
				price: 30,
			});
			await controllerA.retireItem(item.id);

			const health = await controllerA.getItemHealth();
			expect(health.retired).toBe(1);
		});

		it("retireItem via wrong store returns null", async () => {
			const itemA = await controllerA.createItem({
				localProductId: "prod-1",
				sku: "SKU-A-001",
				title: "Store A Item",
				price: 30,
			});

			const result = await controllerB.retireItem(itemA.id);
			expect(result).toBeNull();
		});
	});

	// ── Non-existent resource returns ──────────────────────────────────────

	describe("non-existent resource returns", () => {
		it("getItem on unknown id returns null", async () => {
			expect(await controllerA.getItem("no-such-id")).toBeNull();
		});

		it("getItemByProduct on unknown product returns null", async () => {
			expect(await controllerA.getItemByProduct("no-such-product")).toBeNull();
		});

		it("listItems on empty store returns empty array", async () => {
			expect(await controllerA.listItems()).toEqual([]);
		});

		it("listOrders on empty store returns empty array", async () => {
			expect(await controllerA.listOrders()).toEqual([]);
		});

		it("getLastFeed returns null when no feeds exist", async () => {
			expect(await controllerA.getLastFeed("item")).toBeNull();
		});

		it("listFeeds on empty store returns empty array", async () => {
			expect(await controllerA.listFeeds()).toEqual([]);
		});

		it("getChannelStats on empty store returns all zeros", async () => {
			const stats = await controllerA.getChannelStats();
			expect(stats.totalItems).toBe(0);
			expect(stats.publishedItems).toBe(0);
			expect(stats.totalOrders).toBe(0);
			expect(stats.totalRevenue).toBe(0);
			expect(stats.pendingFeeds).toBe(0);
			expect(stats.errorItems).toBe(0);
		});

		it("getItemHealth on empty store returns all zeros", async () => {
			const health = await controllerA.getItemHealth();
			expect(health.total).toBe(0);
			expect(health.published).toBe(0);
			expect(health.unpublished).toBe(0);
			expect(health.retired).toBe(0);
			expect(health.systemError).toBe(0);
			expect(health.sellerFulfilled).toBe(0);
			expect(health.wfsFulfilled).toBe(0);
		});
	});
});
