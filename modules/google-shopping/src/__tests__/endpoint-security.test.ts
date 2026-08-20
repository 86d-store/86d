import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createGoogleShoppingController } from "../service-impl";

describe("google-shopping endpoint security", () => {
	let mockDataA: ReturnType<typeof createMockDataService>;
	let mockDataB: ReturnType<typeof createMockDataService>;
	let controllerA: ReturnType<typeof createGoogleShoppingController>;
	let controllerB: ReturnType<typeof createGoogleShoppingController>;

	beforeEach(() => {
		mockDataA = createMockDataService();
		mockDataB = createMockDataService();
		controllerA = createGoogleShoppingController(mockDataA);
		controllerB = createGoogleShoppingController(mockDataB);
	});

	// ── Data isolation ─────────────────────────────────────────────────

	describe("data isolation", () => {
		it("feed items created in store A are not visible in store B", async () => {
			await controllerA.createFeedItem({
				localProductId: "prod-1",
				title: "Widget",
				price: 19.99,
				link: "https://example.com/widget",
				imageLink: "https://example.com/widget.jpg",
			});
			const itemsB = await controllerB.listFeedItems();
			expect(itemsB).toHaveLength(0);
		});

		it("feed items created in store B are not visible in store A", async () => {
			await controllerB.createFeedItem({
				localProductId: "prod-1",
				title: "Widget",
				price: 19.99,
				link: "https://example.com/widget",
				imageLink: "https://example.com/widget.jpg",
			});
			const itemsA = await controllerA.listFeedItems();
			expect(itemsA).toHaveLength(0);
		});

		it("store A cannot retrieve a feed item created in store B by id", async () => {
			const item = await controllerB.createFeedItem({
				localProductId: "prod-1",
				title: "Widget",
				price: 19.99,
				link: "https://example.com/widget",
				imageLink: "https://example.com/widget.jpg",
			});
			const result = await controllerA.getFeedItem(item.id);
			expect(result).toBeNull();
		});

		it("store A cannot update a feed item owned by store B", async () => {
			const item = await controllerB.createFeedItem({
				localProductId: "prod-1",
				title: "Widget",
				price: 19.99,
				link: "https://example.com/widget",
				imageLink: "https://example.com/widget.jpg",
			});
			const result = await controllerA.updateFeedItem(item.id, {
				price: 9.99,
			});
			expect(result).toBeNull();
		});

		it("store A cannot delete a feed item owned by store B", async () => {
			const item = await controllerB.createFeedItem({
				localProductId: "prod-1",
				title: "Widget",
				price: 19.99,
				link: "https://example.com/widget",
				imageLink: "https://example.com/widget.jpg",
			});
			const deleted = await controllerA.deleteFeedItem(item.id);
			expect(deleted).toBe(false);
			// Item still accessible in store B
			const stillExists = await controllerB.getFeedItem(item.id);
			expect(stillExists).not.toBeNull();
		});

		it("orders received in store A are not visible in store B", async () => {
			await controllerA.receiveOrder({
				googleOrderId: "G-ORD-001",
				items: [],
				subtotal: 50.0,
				shippingCost: 5.0,
				tax: 4.0,
				total: 59.0,
				shippingAddress: { city: "Mountain View" },
			});
			const ordersB = await controllerB.listOrders();
			expect(ordersB).toHaveLength(0);
		});

		it("store A cannot retrieve an order owned by store B", async () => {
			const order = await controllerB.receiveOrder({
				googleOrderId: "G-ORD-001",
				items: [],
				subtotal: 50.0,
				shippingCost: 5.0,
				tax: 4.0,
				total: 59.0,
				shippingAddress: { city: "Mountain View" },
			});
			const result = await controllerA.getOrder(order.id);
			expect(result).toBeNull();
		});

		it("channel stats in store A do not reflect store B data", async () => {
			await controllerB.createFeedItem({
				localProductId: "prod-1",
				title: "Widget B",
				price: 19.99,
				link: "https://example.com/widget",
				imageLink: "https://example.com/widget.jpg",
				status: "active",
			});
			await controllerB.receiveOrder({
				googleOrderId: "G-ORD-002",
				items: [],
				subtotal: 19.99,
				shippingCost: 3.0,
				tax: 1.5,
				total: 24.49,
				shippingAddress: {},
			});
			const statsA = await controllerA.getChannelStats();
			expect(statsA.totalFeedItems).toBe(0);
			expect(statsA.totalOrders).toBe(0);
			expect(statsA.totalRevenue).toBe(0);
		});

		it("feed item counts are isolated per store", async () => {
			await controllerA.createFeedItem({
				localProductId: "prod-1",
				title: "Item A1",
				price: 10,
				link: "https://example.com/a1",
				imageLink: "https://example.com/a1.jpg",
			});
			await controllerA.createFeedItem({
				localProductId: "prod-2",
				title: "Item A2",
				price: 20,
				link: "https://example.com/a2",
				imageLink: "https://example.com/a2.jpg",
			});
			await controllerB.createFeedItem({
				localProductId: "prod-1",
				title: "Item B1",
				price: 10,
				link: "https://example.com/b1",
				imageLink: "https://example.com/b1.jpg",
			});
			const itemsA = await controllerA.listFeedItems();
			const itemsB = await controllerB.listFeedItems();
			expect(itemsA).toHaveLength(2);
			expect(itemsB).toHaveLength(1);
		});

		it("getFeedItemByProduct does not cross store boundaries", async () => {
			await controllerB.createFeedItem({
				localProductId: "shared-prod-id",
				title: "Shared Widget",
				price: 15,
				link: "https://example.com/shared",
				imageLink: "https://example.com/shared.jpg",
			});
			const result = await controllerA.getFeedItemByProduct("shared-prod-id");
			expect(result).toBeNull();
		});

		it("feed submissions are isolated per store", async () => {
			await controllerA.createFeedItem({
				localProductId: "prod-sub-1",
				title: "Submitted Widget",
				price: 25.0,
				link: "https://example.com/sw",
				imageLink: "https://example.com/sw.jpg",
			});
			await controllerA.submitFeed();
			const lastSubB = await controllerB.getLastSubmission();
			expect(lastSubB).toBeNull();
		});
	});

	// ── Order status transitions ───────────────────────────────────────

	describe("order status transitions", () => {
		it("updateOrderStatus returns null for non-existent order", async () => {
			const result = await controllerA.updateOrderStatus(
				"ghost-order-id",
				"shipped",
				"TRACK-GHOST",
				"UPS",
			);
			expect(result).toBeNull();
		});

		it("updateOrderStatus sets status and persists tracking info", async () => {
			const order = await controllerA.receiveOrder({
				googleOrderId: "G-ORD-CONF-01",
				status: "confirmed",
				items: [],
				subtotal: 35.0,
				shippingCost: 3.5,
				tax: 2.5,
				total: 41.0,
				shippingAddress: { city: "Chicago" },
			});
			const result = await controllerA.updateOrderStatus(
				order.id,
				"shipped",
				"TRACK-CONF-01",
				"USPS",
			);
			expect(result?.status).toBe("shipped");
			expect(result?.trackingNumber).toBe("TRACK-CONF-01");
			expect(result?.carrier).toBe("USPS");
		});

		it("getOrder reflects the latest status after updateOrderStatus", async () => {
			const order = await controllerA.receiveOrder({
				googleOrderId: "G-ORD-PERSIST-01",
				items: [],
				subtotal: 25.0,
				shippingCost: 2.5,
				tax: 2.0,
				total: 29.5,
				shippingAddress: {},
			});
			await controllerA.updateOrderStatus(order.id, "confirmed");
			const fetched = await controllerA.getOrder(order.id);
			expect(fetched?.status).toBe("confirmed");
		});

		it("updateOrderStatus to cancelled removes tracking from future state", async () => {
			const order = await controllerA.receiveOrder({
				googleOrderId: "G-ORD-CANCEL-02",
				status: "confirmed",
				items: [],
				subtotal: 50.0,
				shippingCost: 5.0,
				tax: 4.0,
				total: 59.0,
				shippingAddress: { city: "Denver" },
			});
			const cancelled = await controllerA.updateOrderStatus(
				order.id,
				"cancelled",
			);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("updateOrderStatus on store B order returns null in store A", async () => {
			const order = await controllerB.receiveOrder({
				googleOrderId: "G-ORD-CROSS-01",
				items: [],
				subtotal: 30.0,
				shippingCost: 3.0,
				tax: 2.0,
				total: 35.0,
				shippingAddress: {},
			});
			const result = await controllerA.updateOrderStatus(
				order.id,
				"shipped",
				"TRACK-CROSS",
				"DHL",
			);
			expect(result).toBeNull();
		});
	});

	// ── Resource immutability after deletion ───────────────────────────

	describe("resource immutability", () => {
		it("deleted feed item cannot be retrieved by id", async () => {
			const item = await controllerA.createFeedItem({
				localProductId: "prod-del-1",
				title: "Doomed Widget",
				price: 9.99,
				link: "https://example.com/doomed",
				imageLink: "https://example.com/doomed.jpg",
			});
			await controllerA.deleteFeedItem(item.id);
			const result = await controllerA.getFeedItem(item.id);
			expect(result).toBeNull();
		});

		it("deleted feed item does not appear in listFeedItems", async () => {
			const item = await controllerA.createFeedItem({
				localProductId: "prod-del-2",
				title: "Soon Gone",
				price: 19.99,
				link: "https://example.com/gone",
				imageLink: "https://example.com/gone.jpg",
			});
			await controllerA.createFeedItem({
				localProductId: "prod-keep-1",
				title: "Keeper",
				price: 29.99,
				link: "https://example.com/keep",
				imageLink: "https://example.com/keep.jpg",
			});
			await controllerA.deleteFeedItem(item.id);
			const items = await controllerA.listFeedItems();
			expect(items).toHaveLength(1);
			expect(items[0]?.localProductId).toBe("prod-keep-1");
		});

		it("deleted feed item cannot be updated", async () => {
			const item = await controllerA.createFeedItem({
				localProductId: "prod-del-3",
				title: "Will Be Deleted",
				price: 9.99,
				link: "https://example.com/del3",
				imageLink: "https://example.com/del3.jpg",
			});
			await controllerA.deleteFeedItem(item.id);
			const result = await controllerA.updateFeedItem(item.id, {
				price: 1.0,
			});
			expect(result).toBeNull();
		});

		it("deleting the same feed item twice returns false the second time", async () => {
			const item = await controllerA.createFeedItem({
				localProductId: "prod-del-4",
				title: "Double Delete",
				price: 5.0,
				link: "https://example.com/dd",
				imageLink: "https://example.com/dd.jpg",
			});
			const first = await controllerA.deleteFeedItem(item.id);
			const second = await controllerA.deleteFeedItem(item.id);
			expect(first).toBe(true);
			expect(second).toBe(false);
		});

		it("deleted feed item is not returned by getFeedItemByProduct", async () => {
			const item = await controllerA.createFeedItem({
				localProductId: "prod-del-5",
				title: "Ghost Item",
				price: 12.0,
				link: "https://example.com/ghost",
				imageLink: "https://example.com/ghost.jpg",
			});
			await controllerA.deleteFeedItem(item.id);
			const result = await controllerA.getFeedItemByProduct("prod-del-5");
			expect(result).toBeNull();
		});

		it("channel stats exclude deleted feed items", async () => {
			const item = await controllerA.createFeedItem({
				localProductId: "prod-del-6",
				title: "Stat Ghost",
				price: 20.0,
				link: "https://example.com/sg",
				imageLink: "https://example.com/sg.jpg",
				status: "active",
			});
			const statsBefore = await controllerA.getChannelStats();
			await controllerA.deleteFeedItem(item.id);
			const statsAfter = await controllerA.getChannelStats();
			expect(statsAfter.totalFeedItems).toBe(statsBefore.totalFeedItems - 1);
		});
	});

	// ── Graceful failures for invalid IDs ─────────────────────────────

	describe("graceful failures", () => {
		it("getFeedItem returns null for non-existent id", async () => {
			const result = await controllerA.getFeedItem("does-not-exist");
			expect(result).toBeNull();
		});

		it("getFeedItemByProduct returns null for non-existent product", async () => {
			const result = await controllerA.getFeedItemByProduct("no-such-product");
			expect(result).toBeNull();
		});

		it("updateFeedItem returns null for non-existent id", async () => {
			const result = await controllerA.updateFeedItem("ghost-id", {
				price: 5.0,
			});
			expect(result).toBeNull();
		});

		it("deleteFeedItem returns false for non-existent id", async () => {
			const result = await controllerA.deleteFeedItem("ghost-id");
			expect(result).toBe(false);
		});

		it("getOrder returns null for non-existent id", async () => {
			const result = await controllerA.getOrder("ghost-order-id");
			expect(result).toBeNull();
		});

		it("getLastSubmission returns null when no submissions exist", async () => {
			const result = await controllerA.getLastSubmission();
			expect(result).toBeNull();
		});

		it("channel stats return zero counts when store is empty", async () => {
			const stats = await controllerA.getChannelStats();
			expect(stats.totalFeedItems).toBe(0);
			expect(stats.active).toBe(0);
			expect(stats.totalOrders).toBe(0);
			expect(stats.totalRevenue).toBe(0);
		});

		it("listOrders returns empty array for empty store", async () => {
			const orders = await controllerA.listOrders();
			expect(orders).toHaveLength(0);
		});

		it("listFeedItems returns empty array for empty store", async () => {
			const items = await controllerA.listFeedItems();
			expect(items).toHaveLength(0);
		});

		it("listSubmissions returns empty array when no submissions exist", async () => {
			const submissions = await controllerA.listSubmissions();
			expect(submissions).toHaveLength(0);
		});
	});
});
