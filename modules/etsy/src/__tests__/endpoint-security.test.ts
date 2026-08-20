import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createEtsyController } from "../service-impl";

describe("etsy endpoint security", () => {
	let mockDataA: ReturnType<typeof createMockDataService>;
	let mockDataB: ReturnType<typeof createMockDataService>;
	let controllerA: ReturnType<typeof createEtsyController>;
	let controllerB: ReturnType<typeof createEtsyController>;

	beforeEach(() => {
		mockDataA = createMockDataService();
		mockDataB = createMockDataService();
		controllerA = createEtsyController(mockDataA);
		controllerB = createEtsyController(mockDataB);
	});

	// ── Data isolation ─────────────────────────────────────────────────

	describe("data isolation", () => {
		it("listings created in store A are not visible in store B", async () => {
			await controllerA.createListing({
				localProductId: "prod-1",
				title: "Handmade Mug",
				price: 24.99,
			});
			const listingsB = await controllerB.listListings();
			expect(listingsB).toHaveLength(0);
		});

		it("listings created in store B are not visible in store A", async () => {
			await controllerB.createListing({
				localProductId: "prod-1",
				title: "Handmade Mug",
				price: 24.99,
			});
			const listingsA = await controllerA.listListings();
			expect(listingsA).toHaveLength(0);
		});

		it("store A cannot retrieve a listing created in store B by id", async () => {
			const listing = await controllerB.createListing({
				localProductId: "prod-1",
				title: "Handmade Mug",
				price: 24.99,
			});
			const result = await controllerA.getListing(listing.id);
			expect(result).toBeNull();
		});

		it("store A cannot update a listing owned by store B", async () => {
			const listing = await controllerB.createListing({
				localProductId: "prod-1",
				title: "Handmade Mug",
				price: 24.99,
			});
			const result = await controllerA.updateListing(listing.id, {
				price: 9.99,
			});
			expect(result).toBeNull();
		});

		it("store A cannot delete a listing owned by store B", async () => {
			const listing = await controllerB.createListing({
				localProductId: "prod-1",
				title: "Handmade Mug",
				price: 24.99,
			});
			const deleted = await controllerA.deleteListing(listing.id);
			expect(deleted).toBe(false);
			// Listing still accessible in store B
			const stillExists = await controllerB.getListing(listing.id);
			expect(stillExists).not.toBeNull();
		});

		it("orders received in store A are not visible in store B", async () => {
			await controllerA.receiveOrder({
				etsyReceiptId: "ETSY-RCP-001",
				items: [],
				subtotal: 24.99,
				shippingCost: 5.0,
				etsyFee: 1.5,
				processingFee: 0.5,
				tax: 2.0,
				total: 33.99,
				shippingAddress: { city: "Portland" },
			});
			const ordersB = await controllerB.listOrders();
			expect(ordersB).toHaveLength(0);
		});

		it("store A cannot retrieve an order owned by store B", async () => {
			const order = await controllerB.receiveOrder({
				etsyReceiptId: "ETSY-RCP-001",
				items: [],
				subtotal: 24.99,
				shippingCost: 5.0,
				etsyFee: 1.5,
				processingFee: 0.5,
				tax: 2.0,
				total: 33.99,
				shippingAddress: { city: "Portland" },
			});
			const result = await controllerA.getOrder(order.id);
			expect(result).toBeNull();
		});

		it("channel stats in store A do not reflect store B data", async () => {
			await controllerB.createListing({
				localProductId: "prod-1",
				title: "Vintage Bowl",
				price: 35.0,
				status: "active",
			});
			await controllerB.receiveOrder({
				etsyReceiptId: "ETSY-RCP-002",
				items: [],
				subtotal: 35.0,
				shippingCost: 5.0,
				etsyFee: 2.0,
				processingFee: 0.5,
				tax: 3.0,
				total: 45.5,
				shippingAddress: {},
			});
			const statsA = await controllerA.getChannelStats();
			expect(statsA.totalListings).toBe(0);
			expect(statsA.totalOrders).toBe(0);
			expect(statsA.totalRevenue).toBe(0);
		});

		it("listing counts are isolated per store", async () => {
			await controllerA.createListing({
				localProductId: "prod-1",
				title: "Item A1",
				price: 10,
			});
			await controllerA.createListing({
				localProductId: "prod-2",
				title: "Item A2",
				price: 20,
			});
			await controllerB.createListing({
				localProductId: "prod-1",
				title: "Item B1",
				price: 10,
			});
			const listingsA = await controllerA.listListings();
			const listingsB = await controllerB.listListings();
			expect(listingsA).toHaveLength(2);
			expect(listingsB).toHaveLength(1);
		});

		it("getListingByProduct does not cross store boundaries", async () => {
			await controllerB.createListing({
				localProductId: "shared-prod-id",
				title: "Shared Title",
				price: 15,
			});
			const result = await controllerA.getListingByProduct("shared-prod-id");
			expect(result).toBeNull();
		});

		it("reviews received in store A are not visible in store B", async () => {
			await controllerA.receiveReview({
				etsyTransactionId: "TXN-001",
				rating: 5,
				review: "Great product!",
			});
			const reviewsB = await controllerB.listReviews();
			expect(reviewsB).toHaveLength(0);
		});

		it("average rating is isolated per store", async () => {
			await controllerA.receiveReview({
				etsyTransactionId: "TXN-A-001",
				rating: 2,
			});
			await controllerB.receiveReview({
				etsyTransactionId: "TXN-B-001",
				rating: 5,
			});
			const ratingA = await controllerA.getAverageRating();
			const ratingB = await controllerB.getAverageRating();
			expect(ratingA).toBe(2);
			expect(ratingB).toBe(5);
		});
	});

	// ── Order status transitions ───────────────────────────────────────

	describe("order status transitions", () => {
		it("shipOrder returns null for a non-existent order id", async () => {
			const result = await controllerA.shipOrder(
				"non-existent-id",
				"TRACK999",
				"DHL",
			);
			expect(result).toBeNull();
		});

		it("shipOrder sets status to shipped and persists tracking info", async () => {
			const order = await controllerA.receiveOrder({
				etsyReceiptId: "ETSY-RCP-PAID-01",
				status: "paid",
				items: [],
				subtotal: 50.0,
				shippingCost: 6.0,
				etsyFee: 2.5,
				processingFee: 0.75,
				tax: 4.0,
				total: 63.25,
				shippingAddress: { city: "Austin" },
			});
			const shipped = await controllerA.shipOrder(
				order.id,
				"TRACK-PAID-01",
				"FedEx",
			);
			expect(shipped?.status).toBe("shipped");
			expect(shipped?.trackingNumber).toBe("TRACK-PAID-01");
			expect(shipped?.carrier).toBe("FedEx");
			expect(shipped?.shipDate).toBeInstanceOf(Date);
		});

		it("getOrder reflects the latest status after shipOrder", async () => {
			const order = await controllerA.receiveOrder({
				etsyReceiptId: "ETSY-RCP-PERSIST-01",
				items: [],
				subtotal: 30.0,
				shippingCost: 4.0,
				etsyFee: 1.5,
				processingFee: 0.5,
				tax: 2.5,
				total: 38.5,
				shippingAddress: {},
			});
			await controllerA.shipOrder(order.id, "TRACK-PERSIST", "USPS");
			const fetched = await controllerA.getOrder(order.id);
			expect(fetched?.status).toBe("shipped");
			expect(fetched?.trackingNumber).toBe("TRACK-PERSIST");
		});

		it("renewListing returns null for a non-existent listing", async () => {
			const result = await controllerA.renewListing("ghost-listing-id");
			expect(result).toBeNull();
		});

		it("renewListing updates the listing when it exists", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-renew-1",
				title: "Renewable Item",
				price: 15.0,
			});
			const renewed = await controllerA.renewListing(listing.id);
			expect(renewed).not.toBeNull();
			expect(renewed?.id).toBe(listing.id);
		});

		it("shipOrder on store B order returns null in store A", async () => {
			const order = await controllerB.receiveOrder({
				etsyReceiptId: "ETSY-CROSS-01",
				items: [],
				subtotal: 20.0,
				shippingCost: 3.0,
				etsyFee: 1.0,
				processingFee: 0.25,
				tax: 1.5,
				total: 25.75,
				shippingAddress: {},
			});
			const result = await controllerA.shipOrder(
				order.id,
				"TRACK-CROSS",
				"FedEx",
			);
			expect(result).toBeNull();
		});
	});

	// ── Resource immutability after deletion ───────────────────────────

	describe("resource immutability", () => {
		it("deleted listing cannot be retrieved by id", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-del-1",
				title: "Ghost Pot",
				price: 14.99,
			});
			await controllerA.deleteListing(listing.id);
			const result = await controllerA.getListing(listing.id);
			expect(result).toBeNull();
		});

		it("deleted listing does not appear in listListings", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-del-2",
				title: "Soon Gone",
				price: 19.99,
			});
			await controllerA.createListing({
				localProductId: "prod-keep-1",
				title: "Staying",
				price: 29.99,
			});
			await controllerA.deleteListing(listing.id);
			const listings = await controllerA.listListings();
			expect(listings).toHaveLength(1);
			expect(listings[0]?.localProductId).toBe("prod-keep-1");
		});

		it("deleted listing cannot be updated", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-del-3",
				title: "Doomed Listing",
				price: 9.99,
			});
			await controllerA.deleteListing(listing.id);
			const result = await controllerA.updateListing(listing.id, {
				price: 1.0,
			});
			expect(result).toBeNull();
		});

		it("deleting the same listing twice returns false the second time", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-del-4",
				title: "Double Delete",
				price: 5.0,
			});
			const first = await controllerA.deleteListing(listing.id);
			const second = await controllerA.deleteListing(listing.id);
			expect(first).toBe(true);
			expect(second).toBe(false);
		});

		it("deleted listing is not returned by getListingByProduct", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-del-5",
				title: "Invisible Listing",
				price: 12.0,
			});
			await controllerA.deleteListing(listing.id);
			const result = await controllerA.getListingByProduct("prod-del-5");
			expect(result).toBeNull();
		});

		it("channel stats exclude deleted listings", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-del-6",
				title: "Stat Ghost",
				price: 20.0,
				status: "active",
			});
			const statsBefore = await controllerA.getChannelStats();
			await controllerA.deleteListing(listing.id);
			const statsAfter = await controllerA.getChannelStats();
			expect(statsAfter.totalListings).toBe(statsBefore.totalListings - 1);
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
				price: 5.0,
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

		it("getAverageRating returns 0 when no reviews exist", async () => {
			const rating = await controllerA.getAverageRating();
			expect(rating).toBe(0);
		});

		it("channel stats return zero counts when store is empty", async () => {
			const stats = await controllerA.getChannelStats();
			expect(stats.totalListings).toBe(0);
			expect(stats.active).toBe(0);
			expect(stats.totalOrders).toBe(0);
			expect(stats.totalRevenue).toBe(0);
			expect(stats.totalReviews).toBe(0);
		});

		it("listOrders returns empty array for empty store", async () => {
			const orders = await controllerA.listOrders();
			expect(orders).toHaveLength(0);
		});

		it("listListings returns empty array for empty store", async () => {
			const listings = await controllerA.listListings();
			expect(listings).toHaveLength(0);
		});

		it("listReviews returns empty array for empty store", async () => {
			const reviews = await controllerA.listReviews();
			expect(reviews).toHaveLength(0);
		});

		it("getExpiringListings returns empty array when no listings exist", async () => {
			const expiring = await controllerA.getExpiringListings(7);
			expect(expiring).toHaveLength(0);
		});
	});
});
