import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createTikTokShopController } from "../service-impl";

describe("createTikTokShopController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createTikTokShopController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createTikTokShopController(mockData);
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
			expect(listing.lastSyncedAt).toBeUndefined();
			expect(listing.error).toBeUndefined();
			expect(listing.metadata).toEqual({});
			expect(listing.createdAt).toBeInstanceOf(Date);
			expect(listing.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a listing with all optional fields", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-2",
				externalProductId: "ext-2",
				title: "Full Product",
				status: "active",
				syncStatus: "synced",
				metadata: { sku: "ABC123" },
			});

			expect(listing.externalProductId).toBe("ext-2");
			expect(listing.status).toBe("active");
			expect(listing.syncStatus).toBe("synced");
			expect(listing.metadata).toEqual({ sku: "ABC123" });
		});

		it("creates a listing with description, price, and imageUrl", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-img",
				title: "Product With Image",
				description: "A great product",
				price: 29.99,
				imageUrl: "https://example.com/product.jpg",
			});

			expect(listing.description).toBe("A great product");
			expect(listing.price).toBe(29.99);
			expect(listing.imageUrl).toBe("https://example.com/product.jpg");
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
			expect(updated?.localProductId).toBe("prod-1");
		});

		it("updates listing status and syncStatus", async () => {
			const created = await controller.createListing({
				localProductId: "prod-1",
				title: "Product",
			});

			const updated = await controller.updateListing(created.id, {
				status: "active",
				syncStatus: "synced",
				lastSyncedAt: new Date(),
			});

			expect(updated?.status).toBe("active");
			expect(updated?.syncStatus).toBe("synced");
			expect(updated?.lastSyncedAt).toBeInstanceOf(Date);
		});

		it("returns null for non-existent listing", async () => {
			const result = await controller.updateListing("non-existent", {
				title: "Updated",
			});
			expect(result).toBeNull();
		});

		it("sets error on listing", async () => {
			const created = await controller.createListing({
				localProductId: "prod-1",
				title: "Product",
			});

			const updated = await controller.updateListing(created.id, {
				syncStatus: "failed",
				error: "API rate limit exceeded",
			});

			expect(updated?.syncStatus).toBe("failed");
			expect(updated?.error).toBe("API rate limit exceeded");
		});

		it("updates description, price, and imageUrl", async () => {
			const created = await controller.createListing({
				localProductId: "prod-1",
				title: "Product",
			});

			const updated = await controller.updateListing(created.id, {
				description: "Updated description",
				price: 49.99,
				imageUrl: "https://example.com/updated.jpg",
			});

			expect(updated?.description).toBe("Updated description");
			expect(updated?.price).toBe(49.99);
			expect(updated?.imageUrl).toBe("https://example.com/updated.jpg");
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
			expect(listing?.title).toBe("Product");
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
				title: "Product One",
			});
			await controller.createListing({
				localProductId: "prod-2",
				title: "Product Two",
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
			expect(listings[0]?.title).toBe("Active");
		});

		it("filters by syncStatus", async () => {
			await controller.createListing({
				localProductId: "prod-1",
				title: "Synced",
				syncStatus: "synced",
			});
			await controller.createListing({
				localProductId: "prod-2",
				title: "Failed",
				syncStatus: "failed",
			});

			const listings = await controller.listListings({
				syncStatus: "failed",
			});
			expect(listings).toHaveLength(1);
			expect(listings[0]?.title).toBe("Failed");
		});
	});

	// ── syncCatalog ────────────────────────────────────────────────────────

	describe("syncCatalog", () => {
		it("creates a catalog sync record", async () => {
			const sync = await controller.syncCatalog();

			expect(sync.id).toBeDefined();
			expect(sync.status).toBe("pending");
			expect(sync.totalProducts).toBe(0);
			expect(sync.syncedProducts).toBe(0);
			expect(sync.failedProducts).toBe(0);
			expect(sync.startedAt).toBeInstanceOf(Date);
			expect(sync.completedAt).toBeUndefined();
		});
	});

	// ── getLastSync ────────────────────────────────────────────────────────

	describe("getLastSync", () => {
		it("returns a sync when syncs exist", async () => {
			await controller.syncCatalog();
			await controller.syncCatalog();

			const last = await controller.getLastSync();
			expect(last).not.toBeNull();
			expect(last?.id as string).toBeDefined();
			expect(last?.status).toBe("pending");
		});

		it("returns null when no syncs exist", async () => {
			const last = await controller.getLastSync();
			expect(last).toBeNull();
		});
	});

	// ── listSyncs ──────────────────────────────────────────────────────────

	describe("listSyncs", () => {
		it("lists all catalog syncs", async () => {
			await controller.syncCatalog();
			await controller.syncCatalog();

			const syncs = await controller.listSyncs();
			expect(syncs).toHaveLength(2);
		});
	});

	// ── receiveOrder ───────────────────────────────────────────────────────

	describe("receiveOrder", () => {
		it("creates an order from external data", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "tt-order-1",
				items: [{ productId: "prod-1", quantity: 2, price: 29.99 }],
				subtotal: 59.98,
				shippingFee: 5.0,
				platformFee: 3.0,
				total: 67.98,
				customerName: "John Doe",
				shippingAddress: { city: "Los Angeles", state: "CA" },
			});

			expect(order.id).toBeDefined();
			expect(order.externalOrderId).toBe("tt-order-1");
			expect(order.status).toBe("pending");
			expect(order.items).toHaveLength(1);
			expect(order.subtotal).toBe(59.98);
			expect(order.shippingFee).toBe(5.0);
			expect(order.platformFee).toBe(3.0);
			expect(order.total).toBe(67.98);
			expect(order.customerName).toBe("John Doe");
			expect(order.trackingNumber).toBeUndefined();
			expect(order.trackingUrl).toBeUndefined();
		});

		it("creates an order with a specific status", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "tt-order-2",
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
				externalOrderId: "tt-order-1",
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
		it("updates order status", async () => {
			const created = await controller.receiveOrder({
				externalOrderId: "tt-order-1",
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
				"TRK123",
				"https://track.example.com/TRK123",
			);

			expect(updated?.status).toBe("shipped");
			expect(updated?.trackingNumber).toBe("TRK123");
			expect(updated?.trackingUrl).toBe("https://track.example.com/TRK123");
		});

		it("updates status without tracking info", async () => {
			const created = await controller.receiveOrder({
				externalOrderId: "tt-order-1",
				items: [],
				subtotal: 0,
				shippingFee: 0,
				platformFee: 0,
				total: 0,
				shippingAddress: {},
			});

			const updated = await controller.updateOrderStatus(
				created.id,
				"confirmed",
			);

			expect(updated?.status).toBe("confirmed");
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
				externalOrderId: "tt-order-1",
				items: [],
				subtotal: 0,
				shippingFee: 0,
				platformFee: 0,
				total: 0,
				shippingAddress: {},
			});
			await controller.receiveOrder({
				externalOrderId: "tt-order-2",
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
				externalOrderId: "tt-order-1",
				status: "pending",
				items: [],
				subtotal: 0,
				shippingFee: 0,
				platformFee: 0,
				total: 0,
				shippingAddress: {},
			});
			await controller.receiveOrder({
				externalOrderId: "tt-order-2",
				status: "confirmed",
				items: [],
				subtotal: 0,
				shippingFee: 0,
				platformFee: 0,
				total: 0,
				shippingAddress: {},
			});

			const orders = await controller.listOrders({ status: "confirmed" });
			expect(orders).toHaveLength(1);
		});
	});

	// ── getChannelStats ────────────────────────────────────────────────────

	describe("getChannelStats", () => {
		it("returns stats with no data", async () => {
			const stats = await controller.getChannelStats();

			expect(stats.totalListings).toBe(0);
			expect(stats.activeListings).toBe(0);
			expect(stats.totalOrders).toBe(0);
			expect(stats.totalRevenue).toBe(0);
		});

		it("computes stats from listings and orders", async () => {
			await controller.createListing({
				localProductId: "prod-1",
				title: "Active Product",
				status: "active",
			});
			await controller.createListing({
				localProductId: "prod-2",
				title: "Pending Product",
				status: "pending",
			});
			await controller.createListing({
				localProductId: "prod-3",
				title: "Failed Product",
				syncStatus: "failed",
			});

			await controller.receiveOrder({
				externalOrderId: "tt-order-1",
				status: "delivered",
				items: [],
				subtotal: 100,
				shippingFee: 5,
				platformFee: 3,
				total: 108,
				shippingAddress: {},
			});
			await controller.receiveOrder({
				externalOrderId: "tt-order-2",
				status: "cancelled",
				items: [],
				subtotal: 50,
				shippingFee: 5,
				platformFee: 2,
				total: 57,
				shippingAddress: {},
			});

			const stats = await controller.getChannelStats();

			expect(stats.totalListings).toBe(3);
			expect(stats.activeListings).toBe(1);
			expect(stats.pendingListings).toBe(1);
			expect(stats.failedListings).toBe(1);
			expect(stats.totalOrders).toBe(2);
			expect(stats.deliveredOrders).toBe(1);
			expect(stats.cancelledOrders).toBe(1);
			expect(stats.totalRevenue).toBe(108);
		});
	});
});
