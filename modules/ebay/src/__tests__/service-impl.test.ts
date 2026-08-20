import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createEbayController } from "../service-impl";

describe("createEbayController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createEbayController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createEbayController(mockData);
	});

	// ── createListing ──────────────────────────────────────────────────────────

	describe("createListing", () => {
		it("creates a draft listing with minimal fields", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				title: "Test Item",
				price: 29.99,
			});

			expect(listing.id).toBeDefined();
			expect(listing.localProductId).toBe("prod-1");
			expect(listing.title).toBe("Test Item");
			expect(listing.status).toBe("draft");
			expect(listing.listingType).toBe("fixed-price");
			expect(listing.price).toBe(29.99);
			expect(listing.bidCount).toBe(0);
			expect(listing.quantity).toBe(1);
			expect(listing.condition).toBe("new");
			expect(listing.watchers).toBe(0);
			expect(listing.views).toBe(0);
			expect(listing.createdAt).toBeInstanceOf(Date);
			expect(listing.updatedAt).toBeInstanceOf(Date);
		});

		it("creates an auction listing", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-2",
				title: "Auction Item",
				price: 100,
				listingType: "auction",
				auctionStartPrice: 9.99,
			});

			expect(listing.listingType).toBe("auction");
			expect(listing.auctionStartPrice).toBe(9.99);
		});

		it("creates a listing with custom condition and quantity", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-3",
				title: "Used Item",
				price: 15,
				condition: "good",
				quantity: 5,
			});

			expect(listing.condition).toBe("good");
			expect(listing.quantity).toBe(5);
		});

		it("creates a listing with category and duration", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-4",
				title: "Category Item",
				price: 50,
				categoryId: "cat-123",
				duration: "GTC",
			});

			expect(listing.categoryId).toBe("cat-123");
			expect(listing.duration).toBe("GTC");
		});

		it("creates a listing with metadata", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-5",
				title: "Meta Item",
				price: 20,
				metadata: { color: "red" },
			});

			expect(listing.metadata).toEqual({ color: "red" });
		});
	});

	// ── updateListing ──────────────────────────────────────────────────────────

	describe("updateListing", () => {
		it("updates listing title and price", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				title: "Original",
				price: 10,
			});

			const updated = await controller.updateListing(listing.id, {
				title: "Updated",
				price: 20,
			});

			expect(updated?.title).toBe("Updated");
			expect(updated?.price).toBe(20);
		});

		it("returns null for non-existent listing", async () => {
			const result = await controller.updateListing("non-existent", {
				title: "Test",
			});
			expect(result).toBeNull();
		});

		it("updates listing status", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				title: "Item",
				price: 10,
			});

			const updated = await controller.updateListing(listing.id, {
				status: "active",
			});

			expect(updated?.status).toBe("active");
		});

		it("updates ebayItemId on sync", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				title: "Item",
				price: 10,
			});

			const updated = await controller.updateListing(listing.id, {
				ebayItemId: "ebay-12345",
			});

			expect(updated?.ebayItemId).toBe("ebay-12345");
		});
	});

	// ── endListing ─────────────────────────────────────────────────────────────

	describe("endListing", () => {
		it("ends an active listing", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				title: "Item",
				price: 10,
			});

			const ended = await controller.endListing(listing.id);

			expect(ended?.status).toBe("ended");
			expect(ended?.endTime).toBeInstanceOf(Date);
		});

		it("returns null for non-existent listing", async () => {
			const result = await controller.endListing("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── getListing ──────────────────────────────────────────────────────────────

	describe("getListing", () => {
		it("returns a listing by id", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				title: "Item",
				price: 10,
			});

			const found = await controller.getListing(listing.id);
			expect(found?.id as string).toBe(listing.id);
			expect(found?.title).toBe("Item");
		});

		it("returns null for non-existent listing", async () => {
			const result = await controller.getListing("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── getListingByProduct ────────────────────────────────────────────────────

	describe("getListingByProduct", () => {
		it("finds a listing by product id", async () => {
			await controller.createListing({
				localProductId: "prod-1",
				title: "Item",
				price: 10,
			});

			const found = await controller.getListingByProduct("prod-1");
			expect(found?.localProductId).toBe("prod-1");
		});

		it("returns null when no listing exists for product", async () => {
			const result = await controller.getListingByProduct("unknown");
			expect(result).toBeNull();
		});
	});

	// ── listListings ───────────────────────────────────────────────────────────

	describe("listListings", () => {
		it("returns all listings", async () => {
			await controller.createListing({
				localProductId: "prod-1",
				title: "Item 1",
				price: 10,
			});
			await controller.createListing({
				localProductId: "prod-2",
				title: "Item 2",
				price: 20,
			});

			const listings = await controller.listListings();
			expect(listings).toHaveLength(2);
		});

		it("filters listings by status", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				title: "Item",
				price: 10,
			});
			await controller.updateListing(listing.id, { status: "active" });
			await controller.createListing({
				localProductId: "prod-2",
				title: "Item 2",
				price: 20,
			});

			const active = await controller.listListings({ status: "active" });
			expect(active).toHaveLength(1);
		});

		it("paginates with take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createListing({
					localProductId: `prod-${i}`,
					title: `Item ${i}`,
					price: 10 + i,
				});
			}

			const page = await controller.listListings({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	// ── receiveOrder ───────────────────────────────────────────────────────────

	describe("receiveOrder", () => {
		it("creates a new order", async () => {
			const order = await controller.receiveOrder({
				ebayOrderId: "ebay-order-1",
				items: [{ sku: "SKU-1", qty: 1 }],
				subtotal: 29.99,
				shippingCost: 5.0,
				ebayFee: 3.5,
				paymentProcessingFee: 1.2,
				total: 39.69,
				buyerUsername: "buyer123",
				buyerName: "John Doe",
			});

			expect(order.id).toBeDefined();
			expect(order.ebayOrderId).toBe("ebay-order-1");
			expect(order.status).toBe("pending");
			expect(order.total).toBe(39.69);
			expect(order.buyerUsername).toBe("buyer123");
			expect(order.createdAt).toBeInstanceOf(Date);
		});

		it("creates an order with minimal fields", async () => {
			const order = await controller.receiveOrder({
				ebayOrderId: "ebay-order-2",
				items: [],
				subtotal: 10,
				shippingCost: 0,
				ebayFee: 1,
				paymentProcessingFee: 0.5,
				total: 11.5,
			});

			expect(order.buyerUsername).toBeUndefined();
			expect(order.shippingAddress).toEqual({});
		});
	});

	// ── getOrder ───────────────────────────────────────────────────────────────

	describe("getOrder", () => {
		it("returns an order by id", async () => {
			const order = await controller.receiveOrder({
				ebayOrderId: "ebay-order-1",
				items: [],
				subtotal: 10,
				shippingCost: 0,
				ebayFee: 1,
				paymentProcessingFee: 0.5,
				total: 11.5,
			});

			const found = await controller.getOrder(order.id);
			expect(found?.id as string).toBe(order.id);
		});

		it("returns null for non-existent order", async () => {
			const result = await controller.getOrder("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── shipOrder ──────────────────────────────────────────────────────────────

	describe("shipOrder", () => {
		it("marks order as shipped with tracking", async () => {
			const order = await controller.receiveOrder({
				ebayOrderId: "ebay-order-1",
				items: [],
				subtotal: 10,
				shippingCost: 5,
				ebayFee: 1,
				paymentProcessingFee: 0.5,
				total: 16.5,
			});

			const shipped = await controller.shipOrder(order.id, "TRACK123", "USPS");

			expect(shipped?.status).toBe("shipped");
			expect(shipped?.trackingNumber).toBe("TRACK123");
			expect(shipped?.carrier).toBe("USPS");
			expect(shipped?.shipDate).toBeInstanceOf(Date);
		});

		it("returns null for non-existent order", async () => {
			const result = await controller.shipOrder("non-existent", "TRACK", "UPS");
			expect(result).toBeNull();
		});
	});

	// ── listOrders ─────────────────────────────────────────────────────────────

	describe("listOrders", () => {
		it("returns all orders", async () => {
			await controller.receiveOrder({
				ebayOrderId: "o-1",
				items: [],
				subtotal: 10,
				shippingCost: 0,
				ebayFee: 1,
				paymentProcessingFee: 0.5,
				total: 11.5,
			});
			await controller.receiveOrder({
				ebayOrderId: "o-2",
				items: [],
				subtotal: 20,
				shippingCost: 0,
				ebayFee: 2,
				paymentProcessingFee: 1,
				total: 23,
			});

			const orders = await controller.listOrders();
			expect(orders).toHaveLength(2);
		});

		it("filters orders by status", async () => {
			const order = await controller.receiveOrder({
				ebayOrderId: "o-1",
				items: [],
				subtotal: 10,
				shippingCost: 5,
				ebayFee: 1,
				paymentProcessingFee: 0.5,
				total: 16.5,
			});
			await controller.shipOrder(order.id, "TRACK", "UPS");

			const shipped = await controller.listOrders({ status: "shipped" });
			expect(shipped).toHaveLength(1);
		});
	});

	// ── getChannelStats ────────────────────────────────────────────────────────

	describe("getChannelStats", () => {
		it("returns empty stats when no data", async () => {
			const stats = await controller.getChannelStats();

			expect(stats.totalListings).toBe(0);
			expect(stats.activeListings).toBe(0);
			expect(stats.totalOrders).toBe(0);
			expect(stats.totalRevenue).toBe(0);
			expect(stats.activeAuctions).toBe(0);
			expect(stats.averagePrice).toBe(0);
		});

		it("computes stats from listings and orders", async () => {
			const listing = await controller.createListing({
				localProductId: "p1",
				title: "Item",
				price: 50,
			});
			await controller.updateListing(listing.id, { status: "active" });

			await controller.receiveOrder({
				ebayOrderId: "o-1",
				items: [],
				subtotal: 50,
				shippingCost: 5,
				ebayFee: 3,
				paymentProcessingFee: 1,
				total: 59,
			});

			const stats = await controller.getChannelStats();
			expect(stats.totalListings).toBe(1);
			expect(stats.activeListings).toBe(1);
			expect(stats.totalOrders).toBe(1);
			expect(stats.totalRevenue).toBe(59);
		});
	});

	// ── getActiveAuctions ──────────────────────────────────────────────────────

	describe("getActiveAuctions", () => {
		it("returns only active auction listings", async () => {
			const auction = await controller.createListing({
				localProductId: "p1",
				title: "Auction",
				price: 50,
				listingType: "auction",
			});
			await controller.updateListing(auction.id, { status: "active" });

			const fixed = await controller.createListing({
				localProductId: "p2",
				title: "Fixed",
				price: 30,
				listingType: "fixed-price",
			});
			await controller.updateListing(fixed.id, { status: "active" });

			const auctions = await controller.getActiveAuctions();
			expect(auctions).toHaveLength(1);
			expect(auctions[0]?.listingType).toBe("auction");
		});

		it("returns empty array when no active auctions", async () => {
			const auctions = await controller.getActiveAuctions();
			expect(auctions).toEqual([]);
		});
	});
});
