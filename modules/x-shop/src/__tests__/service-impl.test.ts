import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createXShopController } from "../service-impl";

describe("createXShopController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createXShopController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createXShopController(mockData);
	});

	// ── createListing ──────────────────────────────────────────────────────

	describe("createListing", () => {
		it("creates a listing with minimal fields", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				title: "Test Product",
			});

			expect(listing.id).toBeDefined();
			expect(listing.localProductId).toBe("prod-1");
			expect(listing.title).toBe("Test Product");
			expect(listing.status).toBe("draft");
			expect(listing.syncStatus).toBe("pending");
			expect(listing.metadata).toEqual({});
			expect(listing.createdAt).toBeInstanceOf(Date);
		});

		it("creates a listing with all optional fields", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-2",
				externalProductId: "ext-2",
				title: "Full Product",
				status: "active",
				syncStatus: "synced",
				metadata: { sku: "XYZ789" },
			});

			expect(listing.externalProductId).toBe("ext-2");
			expect(listing.status).toBe("active");
			expect(listing.syncStatus).toBe("synced");
		});

		it("stores the listing in the data service", async () => {
			await controller.createListing({
				localProductId: "prod-3",
				title: "Stored Product",
			});
			expect(mockData.size("listing")).toBe(1);
		});
	});

	// ── updateListing ──────────────────────────────────────────────────────

	describe("updateListing", () => {
		it("updates a listing title", async () => {
			const created = await controller.createListing({
				localProductId: "prod-1",
				title: "Original",
			});

			const updated = await controller.updateListing(created.id, {
				title: "Updated Title",
			});

			expect(updated?.title).toBe("Updated Title");
		});

		it("returns null for non-existent listing", async () => {
			const result = await controller.updateListing("non-existent", {
				title: "X",
			});
			expect(result).toBeNull();
		});

		it("updates listing status", async () => {
			const created = await controller.createListing({
				localProductId: "prod-1",
				title: "Product",
			});

			const updated = await controller.updateListing(created.id, {
				status: "active",
				syncStatus: "synced",
			});

			expect(updated?.status).toBe("active");
			expect(updated?.syncStatus).toBe("synced");
		});

		it("sets error on listing", async () => {
			const created = await controller.createListing({
				localProductId: "prod-1",
				title: "Product",
			});

			const updated = await controller.updateListing(created.id, {
				syncStatus: "failed",
				error: "API error",
			});

			expect(updated?.syncStatus).toBe("failed");
			expect(updated?.error).toBe("API error");
		});
	});

	// ── deleteListing ──────────────────────────────────────────────────────

	describe("deleteListing", () => {
		it("deletes an existing listing", async () => {
			const created = await controller.createListing({
				localProductId: "prod-1",
				title: "Product",
			});

			const deleted = await controller.deleteListing(created.id);
			expect(deleted).toBe(true);
			expect(mockData.size("listing")).toBe(0);
		});

		it("returns false for non-existent listing", async () => {
			const deleted = await controller.deleteListing("non-existent");
			expect(deleted).toBe(false);
		});
	});

	// ── getListing ─────────────────────────────────────────────────────────

	describe("getListing", () => {
		it("retrieves an existing listing", async () => {
			const created = await controller.createListing({
				localProductId: "prod-1",
				title: "Product",
			});

			const listing = await controller.getListing(created.id);
			expect(listing?.id).toBe(created.id);
		});

		it("returns null for non-existent listing", async () => {
			const listing = await controller.getListing("non-existent");
			expect(listing).toBeNull();
		});
	});

	// ── getListingByProduct ────────────────────────────────────────────────

	describe("getListingByProduct", () => {
		it("finds a listing by local product ID", async () => {
			await controller.createListing({
				localProductId: "prod-1",
				title: "Product One",
			});

			const listing = await controller.getListingByProduct("prod-1");
			expect(listing?.localProductId).toBe("prod-1");
		});

		it("returns null when no listing matches", async () => {
			const listing = await controller.getListingByProduct("no-match");
			expect(listing).toBeNull();
		});
	});

	// ── listListings ───────────────────────────────────────────────────────

	describe("listListings", () => {
		it("lists all listings", async () => {
			await controller.createListing({
				localProductId: "prod-1",
				title: "One",
			});
			await controller.createListing({
				localProductId: "prod-2",
				title: "Two",
			});

			const listings = await controller.listListings();
			expect(listings).toHaveLength(2);
		});

		it("filters by status", async () => {
			await controller.createListing({
				localProductId: "prod-1",
				title: "Active",
				status: "active",
			});
			await controller.createListing({
				localProductId: "prod-2",
				title: "Draft",
				status: "draft",
			});

			const listings = await controller.listListings({ status: "active" });
			expect(listings).toHaveLength(1);
		});
	});

	// ── receiveOrder ───────────────────────────────────────────────────────

	describe("receiveOrder", () => {
		it("creates an order from external data", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "x-order-1",
				items: [{ productId: "prod-1", quantity: 1, price: 79.99 }],
				subtotal: 79.99,
				shippingFee: 5.0,
				platformFee: 4.0,
				total: 88.99,
				customerName: "Bob Wilson",
				shippingAddress: { city: "Austin", state: "TX" },
			});

			expect(order.id).toBeDefined();
			expect(order.externalOrderId).toBe("x-order-1");
			expect(order.status).toBe("pending");
			expect(order.total).toBe(88.99);
		});

		it("creates an order with a specific status", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "x-order-2",
				status: "confirmed",
				items: [],
				subtotal: 0,
				shippingFee: 0,
				platformFee: 0,
				total: 0,
				shippingAddress: {},
			});

			expect(order.status).toBe("confirmed");
		});
	});

	// ── getOrder ───────────────────────────────────────────────────────────

	describe("getOrder", () => {
		it("retrieves an existing order", async () => {
			const created = await controller.receiveOrder({
				externalOrderId: "x-order-1",
				items: [],
				subtotal: 0,
				shippingFee: 0,
				platformFee: 0,
				total: 0,
				shippingAddress: {},
			});

			const order = await controller.getOrder(created.id);
			expect(order?.id).toBe(created.id);
		});

		it("returns null for non-existent order", async () => {
			const order = await controller.getOrder("non-existent");
			expect(order).toBeNull();
		});
	});

	// ── updateOrderStatus ──────────────────────────────────────────────────

	describe("updateOrderStatus", () => {
		it("updates order status with tracking", async () => {
			const created = await controller.receiveOrder({
				externalOrderId: "x-order-1",
				items: [],
				subtotal: 0,
				shippingFee: 0,
				platformFee: 0,
				total: 0,
				shippingAddress: {},
			});

			const updated = await controller.updateOrderStatus(
				created.id,
				"shipped",
				"XTRK001",
				"https://track.example.com/XTRK001",
			);

			expect(updated?.status).toBe("shipped");
			expect(updated?.trackingNumber).toBe("XTRK001");
		});

		it("returns null for non-existent order", async () => {
			const result = await controller.updateOrderStatus(
				"non-existent",
				"shipped",
			);
			expect(result).toBeNull();
		});
	});

	// ── listOrders ─────────────────────────────────────────────────────────

	describe("listOrders", () => {
		it("lists all orders", async () => {
			await controller.receiveOrder({
				externalOrderId: "x-order-1",
				items: [],
				subtotal: 0,
				shippingFee: 0,
				platformFee: 0,
				total: 0,
				shippingAddress: {},
			});
			await controller.receiveOrder({
				externalOrderId: "x-order-2",
				items: [],
				subtotal: 0,
				shippingFee: 0,
				platformFee: 0,
				total: 0,
				shippingAddress: {},
			});

			const orders = await controller.listOrders();
			expect(orders).toHaveLength(2);
		});

		it("filters by status", async () => {
			await controller.receiveOrder({
				externalOrderId: "x-order-1",
				status: "pending",
				items: [],
				subtotal: 0,
				shippingFee: 0,
				platformFee: 0,
				total: 0,
				shippingAddress: {},
			});
			await controller.receiveOrder({
				externalOrderId: "x-order-2",
				status: "shipped",
				items: [],
				subtotal: 0,
				shippingFee: 0,
				platformFee: 0,
				total: 0,
				shippingAddress: {},
			});

			const orders = await controller.listOrders({ status: "shipped" });
			expect(orders).toHaveLength(1);
		});
	});

	// ── createDrop ─────────────────────────────────────────────────────────

	describe("createDrop", () => {
		it("creates a product drop", async () => {
			const launchDate = new Date(Date.now() + 86400000);
			const drop = await controller.createDrop({
				name: "Summer Drop",
				description: "Hot summer products",
				productIds: ["prod-1", "prod-2"],
				launchDate,
				tweetId: "tweet-123",
			});

			expect(drop.id).toBeDefined();
			expect(drop.name).toBe("Summer Drop");
			expect(drop.description).toBe("Hot summer products");
			expect(drop.productIds).toEqual(["prod-1", "prod-2"]);
			expect(drop.launchDate).toEqual(launchDate);
			expect(drop.status).toBe("scheduled");
			expect(drop.tweetId).toBe("tweet-123");
			expect(drop.impressions).toBe(0);
			expect(drop.clicks).toBe(0);
			expect(drop.conversions).toBe(0);
		});

		it("creates a drop with end date", async () => {
			const launchDate = new Date(Date.now() + 86400000);
			const endDate = new Date(Date.now() + 172800000);
			const drop = await controller.createDrop({
				name: "Flash Sale",
				productIds: ["prod-1"],
				launchDate,
				endDate,
			});

			expect(drop.endDate).toEqual(endDate);
		});

		it("creates a drop without optional fields", async () => {
			const drop = await controller.createDrop({
				name: "Simple Drop",
				productIds: [],
				launchDate: new Date(),
			});

			expect(drop.description).toBeUndefined();
			expect(drop.endDate).toBeUndefined();
			expect(drop.tweetId).toBeUndefined();
		});
	});

	// ── getDrop ────────────────────────────────────────────────────────────

	describe("getDrop", () => {
		it("retrieves an existing drop", async () => {
			const created = await controller.createDrop({
				name: "Test Drop",
				productIds: ["prod-1"],
				launchDate: new Date(),
			});

			const drop = await controller.getDrop(created.id);
			expect(drop?.id).toBe(created.id);
			expect(drop?.name).toBe("Test Drop");
		});

		it("returns null for non-existent drop", async () => {
			const drop = await controller.getDrop("non-existent");
			expect(drop).toBeNull();
		});
	});

	// ── cancelDrop ─────────────────────────────────────────────────────────

	describe("cancelDrop", () => {
		it("cancels a scheduled drop", async () => {
			const created = await controller.createDrop({
				name: "Test Drop",
				productIds: ["prod-1"],
				launchDate: new Date(Date.now() + 86400000),
			});

			const cancelled = await controller.cancelDrop(created.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("returns the drop unchanged if already ended", async () => {
			const created = await controller.createDrop({
				name: "Test Drop",
				productIds: ["prod-1"],
				launchDate: new Date(),
			});

			// Manually set status to ended
			const endedDrop = {
				...created,
				status: "ended",
			};
			await mockData.upsert(
				"productDrop",
				created.id,
				endedDrop as Record<string, unknown>,
			);

			const result = await controller.cancelDrop(created.id);
			expect(result?.status).toBe("ended");
		});

		it("returns null for non-existent drop", async () => {
			const result = await controller.cancelDrop("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── listDrops ──────────────────────────────────────────────────────────

	describe("listDrops", () => {
		it("lists all drops", async () => {
			await controller.createDrop({
				name: "Drop 1",
				productIds: ["prod-1"],
				launchDate: new Date(),
			});
			await controller.createDrop({
				name: "Drop 2",
				productIds: ["prod-2"],
				launchDate: new Date(),
			});

			const drops = await controller.listDrops();
			expect(drops).toHaveLength(2);
		});

		it("filters by status", async () => {
			await controller.createDrop({
				name: "Scheduled Drop",
				productIds: ["prod-1"],
				launchDate: new Date(Date.now() + 86400000),
			});

			const created = await controller.createDrop({
				name: "To Cancel",
				productIds: ["prod-2"],
				launchDate: new Date(Date.now() + 86400000),
			});
			await controller.cancelDrop(created.id);

			const drops = await controller.listDrops({ status: "cancelled" });
			expect(drops).toHaveLength(1);
			expect(drops[0]?.name).toBe("To Cancel");
		});
	});

	// ── getDropStats ───────────────────────────────────────────────────────

	describe("getDropStats", () => {
		it("returns stats for a drop", async () => {
			const created = await controller.createDrop({
				name: "Stats Drop",
				productIds: ["prod-1"],
				launchDate: new Date(),
			});

			const stats = await controller.getDropStats(created.id);
			expect(stats?.impressions).toBe(0);
			expect(stats?.clicks).toBe(0);
			expect(stats?.conversions).toBe(0);
			expect(stats?.conversionRate).toBe(0);
		});

		it("returns null for non-existent drop", async () => {
			const stats = await controller.getDropStats("non-existent");
			expect(stats).toBeNull();
		});
	});

	// ── getChannelStats ────────────────────────────────────────────────────

	describe("getChannelStats", () => {
		it("returns stats with no data", async () => {
			const stats = await controller.getChannelStats();

			expect(stats.totalListings).toBe(0);
			expect(stats.totalOrders).toBe(0);
			expect(stats.totalRevenue).toBe(0);
		});

		it("computes stats from listings and orders", async () => {
			await controller.createListing({
				localProductId: "prod-1",
				title: "Active",
				status: "active",
			});
			await controller.createListing({
				localProductId: "prod-2",
				title: "Failed",
				syncStatus: "failed",
			});

			await controller.receiveOrder({
				externalOrderId: "x-order-1",
				status: "delivered",
				items: [],
				subtotal: 150,
				shippingFee: 10,
				platformFee: 5,
				total: 165,
				shippingAddress: {},
			});
			await controller.receiveOrder({
				externalOrderId: "x-order-2",
				status: "refunded",
				items: [],
				subtotal: 75,
				shippingFee: 5,
				platformFee: 3,
				total: 83,
				shippingAddress: {},
			});

			const stats = await controller.getChannelStats();

			expect(stats.totalListings).toBe(2);
			expect(stats.activeListings).toBe(1);
			expect(stats.failedListings).toBe(1);
			expect(stats.totalOrders).toBe(2);
			expect(stats.deliveredOrders).toBe(1);
			expect(stats.totalRevenue).toBe(165);
		});
	});
});
