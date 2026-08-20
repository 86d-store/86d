import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createXShopController } from "../service-impl";

describe("x-shop endpoint security", () => {
	let mockDataA: ReturnType<typeof createMockDataService>;
	let mockDataB: ReturnType<typeof createMockDataService>;
	let controllerA: ReturnType<typeof createXShopController>;
	let controllerB: ReturnType<typeof createXShopController>;

	beforeEach(() => {
		mockDataA = createMockDataService();
		mockDataB = createMockDataService();
		controllerA = createXShopController(mockDataA);
		controllerB = createXShopController(mockDataB);
	});

	// ── Data isolation ─────────────────────────────────────────────────

	describe("data isolation", () => {
		it("listings created in store A are not visible in store B", async () => {
			await controllerA.createListing({
				localProductId: "prod-1",
				title: "X Widget",
			});
			const listingsB = await controllerB.listListings();
			expect(listingsB).toHaveLength(0);
		});

		it("listings created in store B are not visible in store A", async () => {
			await controllerB.createListing({
				localProductId: "prod-1",
				title: "X Widget",
			});
			const listingsA = await controllerA.listListings();
			expect(listingsA).toHaveLength(0);
		});

		it("store A cannot retrieve a listing created in store B by id", async () => {
			const listing = await controllerB.createListing({
				localProductId: "prod-2",
				title: "B Widget",
			});
			const result = await controllerA.getListing(listing.id);
			expect(result).toBeNull();
		});

		it("store A cannot update a listing owned by store B", async () => {
			const listing = await controllerB.createListing({
				localProductId: "prod-3",
				title: "B Widget 3",
			});
			const result = await controllerA.updateListing(listing.id, {
				title: "Hijacked",
			});
			expect(result).toBeNull();
		});

		it("store A cannot delete a listing owned by store B", async () => {
			const listing = await controllerB.createListing({
				localProductId: "prod-4",
				title: "B Widget 4",
			});
			const deleted = await controllerA.deleteListing(listing.id);
			expect(deleted).toBe(false);
			// Listing still accessible in store B
			const stillExists = await controllerB.getListing(listing.id);
			expect(stillExists).not.toBeNull();
		});

		it("orders received in store A are not visible in store B", async () => {
			await controllerA.receiveOrder({
				externalOrderId: "X-ORDER-001",
				items: [],
				subtotal: 80,
				shippingFee: 8,
				platformFee: 4,
				total: 92,
				shippingAddress: { city: "Austin" },
			});
			const ordersB = await controllerB.listOrders();
			expect(ordersB).toHaveLength(0);
		});

		it("store A cannot retrieve an order owned by store B", async () => {
			const order = await controllerB.receiveOrder({
				externalOrderId: "X-ORDER-002",
				items: [],
				subtotal: 50,
				shippingFee: 5,
				platformFee: 2,
				total: 57,
				shippingAddress: { city: "Boston" },
			});
			const result = await controllerA.getOrder(order.id);
			expect(result).toBeNull();
		});

		it("store A cannot update order status for an order owned by store B", async () => {
			const order = await controllerB.receiveOrder({
				externalOrderId: "X-ORDER-003",
				items: [],
				subtotal: 40,
				shippingFee: 4,
				platformFee: 2,
				total: 46,
				shippingAddress: {},
			});
			const result = await controllerA.updateOrderStatus(
				order.id,
				"shipped",
				"TRACK-CROSS",
			);
			expect(result).toBeNull();
		});

		it("drops created in store A are not visible in store B", async () => {
			await controllerA.createDrop({
				name: "Summer Drop",
				productIds: ["prod-1"],
				launchDate: new Date("2026-06-01"),
			});
			const dropsB = await controllerB.listDrops();
			expect(dropsB).toHaveLength(0);
		});

		it("store A cannot retrieve a drop owned by store B", async () => {
			const drop = await controllerB.createDrop({
				name: "B Drop",
				productIds: ["prod-b1"],
				launchDate: new Date("2026-07-01"),
			});
			const result = await controllerA.getDrop(drop.id);
			expect(result).toBeNull();
		});

		it("store A cannot cancel a drop owned by store B", async () => {
			const drop = await controllerB.createDrop({
				name: "B Drop 2",
				productIds: ["prod-b2"],
				launchDate: new Date("2026-08-01"),
			});
			const result = await controllerA.cancelDrop(drop.id);
			// cancelDrop returns null because drop is not in store A's data
			expect(result).toBeNull();
		});

		it("channel stats in store A do not reflect store B data", async () => {
			await controllerB.createListing({
				localProductId: "prod-stat-b",
				title: "B Stat Widget",
				status: "active",
			});
			await controllerB.receiveOrder({
				externalOrderId: "X-ORDER-B01",
				items: [],
				subtotal: 300,
				shippingFee: 15,
				platformFee: 10,
				total: 325,
				shippingAddress: {},
			});
			const statsA = await controllerA.getChannelStats();
			expect(statsA.totalListings).toBe(0);
			expect(statsA.totalOrders).toBe(0);
			expect(statsA.totalRevenue).toBe(0);
		});

		it("listing counts are isolated per store", async () => {
			await controllerA.createListing({
				localProductId: "prod-a1",
				title: "A Widget 1",
			});
			await controllerA.createListing({
				localProductId: "prod-a2",
				title: "A Widget 2",
			});
			await controllerB.createListing({
				localProductId: "prod-b1",
				title: "B Widget 1",
			});
			const listingsA = await controllerA.listListings();
			const listingsB = await controllerB.listListings();
			expect(listingsA).toHaveLength(2);
			expect(listingsB).toHaveLength(1);
		});

		it("getListingByProduct does not cross store boundaries", async () => {
			await controllerB.createListing({
				localProductId: "shared-prod",
				title: "Shared Widget",
			});
			const result = await controllerA.getListingByProduct("shared-prod");
			expect(result).toBeNull();
		});
	});

	// ── Order status transitions & state machine ───────────────────────

	describe("order status transitions", () => {
		it("updateOrderStatus returns null for a non-existent order id", async () => {
			const result = await controllerA.updateOrderStatus(
				"non-existent-id",
				"shipped",
				"TRACK999",
			);
			expect(result).toBeNull();
		});

		it("updateOrderStatus to shipped persists tracking info", async () => {
			const order = await controllerA.receiveOrder({
				externalOrderId: "X-SHIP-01",
				items: [],
				subtotal: 55,
				shippingFee: 6,
				platformFee: 3,
				total: 64,
				shippingAddress: { city: "Denver" },
			});
			const shipped = await controllerA.updateOrderStatus(
				order.id,
				"shipped",
				"TRACK-X-001",
				"https://track.example.com/X-001",
			);
			expect(shipped?.status).toBe("shipped");
			expect(shipped?.trackingNumber).toBe("TRACK-X-001");
			expect(shipped?.trackingUrl).toBe("https://track.example.com/X-001");
		});

		it("getOrder reflects the latest status after updateOrderStatus", async () => {
			const order = await controllerA.receiveOrder({
				externalOrderId: "X-SHIP-02",
				items: [],
				subtotal: 70,
				shippingFee: 7,
				platformFee: 3,
				total: 80,
				shippingAddress: {},
			});
			await controllerA.updateOrderStatus(order.id, "shipped", "TRACK-PERSIST");
			const fetched = await controllerA.getOrder(order.id);
			expect(fetched?.status).toBe("shipped");
			expect(fetched?.trackingNumber).toBe("TRACK-PERSIST");
		});

		it("updateOrderStatus to cancelled sets status to cancelled", async () => {
			const order = await controllerA.receiveOrder({
				externalOrderId: "X-CANCEL-01",
				items: [],
				subtotal: 30,
				shippingFee: 3,
				platformFee: 1,
				total: 34,
				shippingAddress: {},
			});
			const cancelled = await controllerA.updateOrderStatus(
				order.id,
				"cancelled",
			);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("cancelDrop returns null for non-existent drop id", async () => {
			const result = await controllerA.cancelDrop("ghost-drop-id");
			expect(result).toBeNull();
		});

		it("cancelDrop sets drop status to cancelled", async () => {
			const drop = await controllerA.createDrop({
				name: "Fall Drop",
				productIds: ["prod-fall"],
				launchDate: new Date("2026-09-01"),
			});
			const cancelled = await controllerA.cancelDrop(drop.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("cancelDrop on already-cancelled drop keeps cancelled status", async () => {
			const drop = await controllerA.createDrop({
				name: "Double Cancel Drop",
				productIds: ["prod-dc"],
				launchDate: new Date("2026-10-01"),
			});
			await controllerA.cancelDrop(drop.id);
			const cancelledAgain = await controllerA.cancelDrop(drop.id);
			expect(cancelledAgain?.status).toBe("cancelled");
		});
	});

	// ── Resource immutability after deletion ───────────────────────────

	describe("resource immutability after deletion", () => {
		it("deleted listing cannot be retrieved by id", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-del-1",
				title: "To Delete",
			});
			await controllerA.deleteListing(listing.id);
			const result = await controllerA.getListing(listing.id);
			expect(result).toBeNull();
		});

		it("deleted listing does not appear in listListings", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-del-2",
				title: "To Delete 2",
			});
			await controllerA.createListing({
				localProductId: "prod-keep-1",
				title: "Keep Me",
			});
			await controllerA.deleteListing(listing.id);
			const listings = await controllerA.listListings();
			expect(listings).toHaveLength(1);
			expect(listings[0]?.localProductId).toBe("prod-keep-1");
		});

		it("deleted listing cannot be updated", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-del-3",
				title: "Will Be Deleted",
			});
			await controllerA.deleteListing(listing.id);
			const result = await controllerA.updateListing(listing.id, {
				title: "Ghost Update",
			});
			expect(result).toBeNull();
		});

		it("deleting the same listing twice returns false the second time", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-del-4",
				title: "Double Delete",
			});
			const first = await controllerA.deleteListing(listing.id);
			const second = await controllerA.deleteListing(listing.id);
			expect(first).toBe(true);
			expect(second).toBe(false);
		});

		it("deleted listing is not returned by getListingByProduct", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-del-5",
				title: "Ghost Listing",
			});
			await controllerA.deleteListing(listing.id);
			const result = await controllerA.getListingByProduct("prod-del-5");
			expect(result).toBeNull();
		});

		it("channel stats exclude deleted listings", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-del-6",
				title: "Stat Ghost",
				status: "active",
			});
			const statsBefore = await controllerA.getChannelStats();
			await controllerA.deleteListing(listing.id);
			const statsAfter = await controllerA.getChannelStats();
			expect(statsAfter.totalListings).toBe(statsBefore.totalListings - 1);
		});
	});

	// ── Stats isolation ────────────────────────────────────────────────

	describe("stats isolation", () => {
		it("getChannelStats activeListings only counts active listings in own store", async () => {
			const listingA = await controllerA.createListing({
				localProductId: "stat-a1",
				title: "Active A",
			});
			await controllerA.updateListing(listingA.id, { status: "active" });
			// Store B has two active listings
			const listingB1 = await controllerB.createListing({
				localProductId: "stat-b1",
				title: "Active B1",
			});
			await controllerB.updateListing(listingB1.id, { status: "active" });
			const listingB2 = await controllerB.createListing({
				localProductId: "stat-b2",
				title: "Active B2",
			});
			await controllerB.updateListing(listingB2.id, { status: "active" });
			const statsA = await controllerA.getChannelStats();
			expect(statsA.activeListings).toBe(1);
		});

		it("getChannelStats totalRevenue excludes cancelled/refunded orders", async () => {
			const orderA = await controllerA.receiveOrder({
				externalOrderId: "X-REV-01",
				items: [],
				subtotal: 100,
				shippingFee: 10,
				platformFee: 5,
				total: 115,
				shippingAddress: {},
			});
			await controllerA.updateOrderStatus(orderA.id, "cancelled");
			const orderB = await controllerA.receiveOrder({
				externalOrderId: "X-REV-02",
				items: [],
				subtotal: 80,
				shippingFee: 8,
				platformFee: 4,
				total: 92,
				shippingAddress: {},
			});
			// orderB is delivered
			await controllerA.updateOrderStatus(orderB.id, "delivered");
			const stats = await controllerA.getChannelStats();
			// Only delivered order counted in revenue
			expect(stats.totalRevenue).toBe(92);
		});

		it("getChannelStats returns zero values for empty store", async () => {
			const stats = await controllerA.getChannelStats();
			expect(stats.totalListings).toBe(0);
			expect(stats.activeListings).toBe(0);
			expect(stats.pendingListings).toBe(0);
			expect(stats.failedListings).toBe(0);
			expect(stats.totalOrders).toBe(0);
			expect(stats.pendingOrders).toBe(0);
			expect(stats.shippedOrders).toBe(0);
			expect(stats.deliveredOrders).toBe(0);
			expect(stats.cancelledOrders).toBe(0);
			expect(stats.totalRevenue).toBe(0);
		});

		it("getDropStats returns null for non-existent drop", async () => {
			const result = await controllerA.getDropStats("ghost-drop-id");
			expect(result).toBeNull();
		});

		it("getDropStats returns null for drop in another store", async () => {
			const drop = await controllerB.createDrop({
				name: "B Stats Drop",
				productIds: ["prod-b-stat"],
				launchDate: new Date("2026-11-01"),
			});
			const result = await controllerA.getDropStats(drop.id);
			expect(result).toBeNull();
		});
	});

	// ── Graceful failures for invalid IDs ─────────────────────────────

	describe("graceful failures", () => {
		it("getListing returns null for non-existent id", async () => {
			const result = await controllerA.getListing("does-not-exist");
			expect(result).toBeNull();
		});

		it("getListingByProduct returns null for non-existent product", async () => {
			const result = await controllerA.getListingByProduct("no-such-product");
			expect(result).toBeNull();
		});

		it("updateListing returns null for non-existent id", async () => {
			const result = await controllerA.updateListing("ghost-id", {
				title: "Ghost",
			});
			expect(result).toBeNull();
		});

		it("deleteListing returns false for non-existent id", async () => {
			const result = await controllerA.deleteListing("ghost-id");
			expect(result).toBe(false);
		});

		it("getOrder returns null for non-existent id", async () => {
			const result = await controllerA.getOrder("ghost-order-id");
			expect(result).toBeNull();
		});

		it("updateOrderStatus returns null for non-existent id", async () => {
			const result = await controllerA.updateOrderStatus(
				"ghost-order-id",
				"delivered",
			);
			expect(result).toBeNull();
		});

		it("getDrop returns null for non-existent id", async () => {
			const result = await controllerA.getDrop("ghost-drop-id");
			expect(result).toBeNull();
		});

		it("listOrders returns empty array for empty store", async () => {
			const orders = await controllerA.listOrders();
			expect(orders).toHaveLength(0);
		});

		it("listListings returns empty array for empty store", async () => {
			const listings = await controllerA.listListings();
			expect(listings).toHaveLength(0);
		});

		it("listDrops returns empty array for empty store", async () => {
			const drops = await controllerA.listDrops();
			expect(drops).toHaveLength(0);
		});
	});
});
