import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createFacebookShopController } from "../service-impl";

describe("createFacebookShopController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createFacebookShopController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createFacebookShopController(mockData);
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
				metadata: { sku: "ABC123" },
			});

			expect(listing.externalProductId).toBe("ext-2");
			expect(listing.status).toBe("active");
			expect(listing.syncStatus).toBe("synced");
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
		});

		it("returns null for non-existent listing", async () => {
			const result = await controller.updateListing("non-existent", {
				title: "X",
			});
			expect(result).toBeNull();
		});

		it("updates listing status and syncStatus", async () => {
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

		it("sets error on listing", async () => {
			const created = await controller.createListing({
				localProductId: "prod-1",
				title: "Product",
			});

			const updated = await controller.updateListing(created.id, {
				syncStatus: "failed",
				error: "Rate limit exceeded",
			});

			expect(updated?.syncStatus).toBe("failed");
			expect(updated?.error).toBe("Rate limit exceeded");
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

	// ── syncCatalog ────────────────────────────────────────────────────────

	describe("syncCatalog", () => {
		it("creates a catalog sync record", async () => {
			const sync = await controller.syncCatalog();

			expect(sync.id).toBeDefined();
			expect(sync.status).toBe("pending");
			expect(sync.totalProducts).toBe(0);
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
				externalOrderId: "fb-order-1",
				items: [{ productId: "prod-1", quantity: 3, price: 19.99 }],
				subtotal: 59.97,
				shippingFee: 5.0,
				platformFee: 3.0,
				total: 67.97,
				customerName: "Alice Johnson",
				shippingAddress: { city: "Chicago", state: "IL" },
			});

			expect(order.id).toBeDefined();
			expect(order.externalOrderId).toBe("fb-order-1");
			expect(order.status).toBe("pending");
			expect(order.total).toBe(67.97);
			expect(order.customerName).toBe("Alice Johnson");
		});

		it("creates an order with a specific status", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "fb-order-2",
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
				externalOrderId: "fb-order-1",
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
				externalOrderId: "fb-order-1",
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
				"TRK789",
				"https://track.example.com/TRK789",
			);

			expect(updated?.status).toBe("shipped");
			expect(updated?.trackingNumber).toBe("TRK789");
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
				externalOrderId: "fb-order-1",
				items: [],
				subtotal: 0,
				shippingFee: 0,
				platformFee: 0,
				total: 0,
				shippingAddress: {},
			});
			await controller.receiveOrder({
				externalOrderId: "fb-order-2",
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
				externalOrderId: "fb-order-1",
				status: "pending",
				items: [],
				subtotal: 0,
				shippingFee: 0,
				platformFee: 0,
				total: 0,
				shippingAddress: {},
			});
			await controller.receiveOrder({
				externalOrderId: "fb-order-2",
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

	// ── createCollection ───────────────────────────────────────────────────

	describe("createCollection", () => {
		it("creates a collection with products", async () => {
			const collection = await controller.createCollection("Summer Sale", [
				"prod-1",
				"prod-2",
			]);

			expect(collection.id).toBeDefined();
			expect(collection.name).toBe("Summer Sale");
			expect(collection.productIds).toEqual(["prod-1", "prod-2"]);
			expect(collection.status).toBe("active");
			expect(collection.createdAt).toBeInstanceOf(Date);
		});

		it("creates an empty collection", async () => {
			const collection = await controller.createCollection("Empty", []);

			expect(collection.productIds).toEqual([]);
		});
	});

	// ── deleteCollection ───────────────────────────────────────────────────

	describe("deleteCollection", () => {
		it("deletes an existing collection", async () => {
			const created = await controller.createCollection("Test", ["prod-1"]);

			const deleted = await controller.deleteCollection(created.id);
			expect(deleted).toBe(true);
			expect(mockData.size("collection")).toBe(0);
		});

		it("returns false for non-existent collection", async () => {
			const deleted = await controller.deleteCollection("non-existent");
			expect(deleted).toBe(false);
		});
	});

	// ── listCollections ────────────────────────────────────────────────────

	describe("listCollections", () => {
		it("lists all collections", async () => {
			await controller.createCollection("Collection A", ["prod-1"]);
			await controller.createCollection("Collection B", ["prod-2"]);

			const collections = await controller.listCollections();
			expect(collections).toHaveLength(2);
		});

		it("returns empty array when no collections exist", async () => {
			const collections = await controller.listCollections();
			expect(collections).toEqual([]);
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
				title: "Pending",
				status: "pending",
			});

			await controller.receiveOrder({
				externalOrderId: "fb-order-1",
				status: "delivered",
				items: [],
				subtotal: 200,
				shippingFee: 10,
				platformFee: 5,
				total: 215,
				shippingAddress: {},
			});
			await controller.receiveOrder({
				externalOrderId: "fb-order-2",
				status: "cancelled",
				items: [],
				subtotal: 50,
				shippingFee: 5,
				platformFee: 2,
				total: 57,
				shippingAddress: {},
			});

			const stats = await controller.getChannelStats();

			expect(stats.totalListings).toBe(2);
			expect(stats.activeListings).toBe(1);
			expect(stats.pendingListings).toBe(1);
			expect(stats.totalOrders).toBe(2);
			expect(stats.deliveredOrders).toBe(1);
			expect(stats.cancelledOrders).toBe(1);
			expect(stats.totalRevenue).toBe(215);
		});
	});
});
