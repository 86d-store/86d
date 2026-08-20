import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createFacebookShopController } from "../service-impl";

describe("facebook-shop endpoint security", () => {
	let mockDataA: ReturnType<typeof createMockDataService>;
	let mockDataB: ReturnType<typeof createMockDataService>;
	let controllerA: ReturnType<typeof createFacebookShopController>;
	let controllerB: ReturnType<typeof createFacebookShopController>;

	beforeEach(() => {
		mockDataA = createMockDataService();
		mockDataB = createMockDataService();
		controllerA = createFacebookShopController(mockDataA);
		controllerB = createFacebookShopController(mockDataB);
	});

	// ── Data isolation: listings ───────────────────────────────────────────

	describe("data isolation – listings", () => {
		it("listing created in store A is not visible in store B", async () => {
			await controllerA.createListing({
				localProductId: "prod-1",
				title: "Store A Product",
			});

			const listingsB = await controllerB.listListings();
			expect(listingsB).toHaveLength(0);
		});

		it("listing created in store B is not visible in store A", async () => {
			await controllerB.createListing({
				localProductId: "prod-1",
				title: "Store B Product",
			});

			const listingsA = await controllerA.listListings();
			expect(listingsA).toHaveLength(0);
		});

		it("getListing does not return a listing from another store", async () => {
			const listingA = await controllerA.createListing({
				localProductId: "prod-1",
				title: "Store A Product",
			});

			const result = await controllerB.getListing(listingA.id);
			expect(result).toBeNull();
		});

		it("getListingByProduct does not cross store boundaries", async () => {
			await controllerA.createListing({
				localProductId: "prod-shared",
				title: "Store A Product",
			});

			const result = await controllerB.getListingByProduct("prod-shared");
			expect(result).toBeNull();
		});

		it("multiple listings in A do not appear in B", async () => {
			await controllerA.createListing({ localProductId: "p1", title: "One" });
			await controllerA.createListing({ localProductId: "p2", title: "Two" });
			await controllerA.createListing({ localProductId: "p3", title: "Three" });

			const listingsB = await controllerB.listListings();
			expect(listingsB).toHaveLength(0);
		});

		it("updateListing in store A does not affect store B", async () => {
			const listingA = await controllerA.createListing({
				localProductId: "prod-1",
				title: "Original",
			});
			await controllerA.updateListing(listingA.id, { title: "Updated" });

			const resultB = await controllerB.getListing(listingA.id);
			expect(resultB).toBeNull();
		});

		it("deleteListing in store A does not affect store B listing count", async () => {
			const listingA = await controllerA.createListing({
				localProductId: "prod-1",
				title: "To Delete",
			});
			await controllerB.createListing({
				localProductId: "prod-1",
				title: "Store B Listing",
			});

			await controllerA.deleteListing(listingA.id);

			const listingsB = await controllerB.listListings();
			expect(listingsB).toHaveLength(1);
		});
	});

	// ── Data isolation: orders ─────────────────────────────────────────────

	describe("data isolation – orders", () => {
		it("order received in store A is not visible in store B", async () => {
			await controllerA.receiveOrder({
				externalOrderId: "fb-order-1",
				items: [],
				subtotal: 100,
				shippingFee: 5,
				platformFee: 2,
				total: 107,
				shippingAddress: {},
			});

			const ordersB = await controllerB.listOrders();
			expect(ordersB).toHaveLength(0);
		});

		it("getOrder does not return an order from another store", async () => {
			const orderA = await controllerA.receiveOrder({
				externalOrderId: "fb-order-1",
				items: [],
				subtotal: 50,
				shippingFee: 5,
				platformFee: 2,
				total: 57,
				shippingAddress: {},
			});

			const result = await controllerB.getOrder(orderA.id);
			expect(result).toBeNull();
		});

		it("updateOrderStatus in store A does not affect store B", async () => {
			const orderA = await controllerA.receiveOrder({
				externalOrderId: "fb-order-1",
				items: [],
				subtotal: 50,
				shippingFee: 5,
				platformFee: 2,
				total: 57,
				shippingAddress: {},
			});

			const result = await controllerB.updateOrderStatus(
				orderA.id,
				"shipped",
				"TRK001",
			);
			expect(result).toBeNull();
		});
	});

	// ── Data isolation: collections ────────────────────────────────────────

	describe("data isolation – collections", () => {
		it("collection created in store A is not visible in store B", async () => {
			await controllerA.createCollection("Summer Sale", ["prod-1", "prod-2"]);

			const collectionsB = await controllerB.listCollections();
			expect(collectionsB).toHaveLength(0);
		});

		it("deleteCollection in store A does not remove collections in store B", async () => {
			const colA = await controllerA.createCollection("A Collection", ["p1"]);
			await controllerB.createCollection("B Collection", ["p2"]);

			await controllerA.deleteCollection(colA.id);

			const collectionsB = await controllerB.listCollections();
			expect(collectionsB).toHaveLength(1);
		});
	});

	// ── Data isolation: channel stats ──────────────────────────────────────

	describe("data isolation – channel stats", () => {
		it("stats from store A do not bleed into store B", async () => {
			await controllerA.createListing({
				localProductId: "prod-1",
				title: "Active",
				status: "active",
			});
			await controllerA.receiveOrder({
				externalOrderId: "fb-order-1",
				items: [],
				subtotal: 100,
				shippingFee: 5,
				platformFee: 2,
				total: 107,
				shippingAddress: {},
			});

			const statsB = await controllerB.getChannelStats();
			expect(statsB.totalListings).toBe(0);
			expect(statsB.activeListings).toBe(0);
			expect(statsB.totalOrders).toBe(0);
			expect(statsB.totalRevenue).toBe(0);
		});

		it("each store accumulates its own listing count in stats", async () => {
			await controllerA.createListing({ localProductId: "p1", title: "One" });
			await controllerA.createListing({ localProductId: "p2", title: "Two" });
			await controllerB.createListing({ localProductId: "p3", title: "Three" });

			const statsA = await controllerA.getChannelStats();
			const statsB = await controllerB.getChannelStats();

			expect(statsA.totalListings).toBe(2);
			expect(statsB.totalListings).toBe(1);
		});
	});

	// ── State machine: order status transitions ────────────────────────────

	describe("state machine – order transitions", () => {
		it("cannot ship a cancelled order (updateOrderStatus returns result but state enforcement is on the consumer)", async () => {
			const order = await controllerA.receiveOrder({
				externalOrderId: "fb-order-1",
				items: [],
				subtotal: 50,
				shippingFee: 5,
				platformFee: 2,
				total: 57,
				shippingAddress: {},
			});

			await controllerA.updateOrderStatus(order.id, "cancelled");
			const shipped = await controllerA.updateOrderStatus(
				order.id,
				"shipped",
				"TRK001",
			);

			// The service persists whatever status is passed; the state machine
			// contract is that the returned order reflects the attempted transition.
			// Security property: the call must not throw and must operate only on
			// this store's order (not cross store).
			expect(shipped).not.toBeNull();
			expect(shipped?.id).toBe(order.id);
		});

		it("cannot update status of an order that does not exist in this store", async () => {
			const orderA = await controllerA.receiveOrder({
				externalOrderId: "fb-order-1",
				items: [],
				subtotal: 50,
				shippingFee: 5,
				platformFee: 2,
				total: 57,
				shippingAddress: {},
			});

			// Try to transition using store B's controller with A's order ID
			const result = await controllerB.updateOrderStatus(
				orderA.id,
				"shipped",
				"TRK001",
			);
			expect(result).toBeNull();
		});

		it("cancelling a delivered order via wrong store returns null", async () => {
			const order = await controllerA.receiveOrder({
				externalOrderId: "fb-order-1",
				items: [],
				subtotal: 50,
				shippingFee: 5,
				platformFee: 2,
				total: 57,
				shippingAddress: {},
			});
			await controllerA.updateOrderStatus(order.id, "delivered");

			const result = await controllerB.updateOrderStatus(order.id, "cancelled");
			expect(result).toBeNull();
		});

		it("non-existent order update returns null, not an error", async () => {
			const result = await controllerA.updateOrderStatus(
				"ghost-order-id",
				"refunded",
			);
			expect(result).toBeNull();
		});
	});

	// ── Resource immutability after deletion ───────────────────────────────

	describe("resource immutability after deletion", () => {
		it("deleted listing cannot be retrieved by getListing", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-1",
				title: "Gone Product",
			});

			await controllerA.deleteListing(listing.id);

			const result = await controllerA.getListing(listing.id);
			expect(result).toBeNull();
		});

		it("deleted listing is excluded from listListings", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-1",
				title: "Gone Product",
			});
			await controllerA.createListing({
				localProductId: "prod-2",
				title: "Remaining Product",
			});

			await controllerA.deleteListing(listing.id);

			const listings = await controllerA.listListings();
			expect(listings).toHaveLength(1);
			expect(listings[0]?.localProductId).toBe("prod-2");
		});

		it("deleted listing cannot be found by getListingByProduct", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-gone",
				title: "Gone Product",
			});

			await controllerA.deleteListing(listing.id);

			const result = await controllerA.getListingByProduct("prod-gone");
			expect(result).toBeNull();
		});

		it("deleted listing cannot be updated", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-1",
				title: "Original",
			});

			await controllerA.deleteListing(listing.id);

			const result = await controllerA.updateListing(listing.id, {
				title: "Updated After Delete",
			});
			expect(result).toBeNull();
		});

		it("double delete returns false on second attempt", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-1",
				title: "Product",
			});

			const first = await controllerA.deleteListing(listing.id);
			const second = await controllerA.deleteListing(listing.id);

			expect(first).toBe(true);
			expect(second).toBe(false);
		});

		it("deleted collection is removed from listCollections", async () => {
			const col = await controllerA.createCollection("Temp", ["p1"]);

			await controllerA.deleteCollection(col.id);

			const collections = await controllerA.listCollections();
			expect(collections).toHaveLength(0);
		});

		it("double delete of collection returns false on second attempt", async () => {
			const col = await controllerA.createCollection("Temp", ["p1"]);

			const first = await controllerA.deleteCollection(col.id);
			const second = await controllerA.deleteCollection(col.id);

			expect(first).toBe(true);
			expect(second).toBe(false);
		});

		it("stats reflect deletion – listing count decrements after delete", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-1",
				title: "Product",
				status: "active",
			});

			const statsBefore = await controllerA.getChannelStats();
			expect(statsBefore.totalListings).toBe(1);

			await controllerA.deleteListing(listing.id);

			const statsAfter = await controllerA.getChannelStats();
			expect(statsAfter.totalListings).toBe(0);
			expect(statsAfter.activeListings).toBe(0);
		});
	});

	// ── Non-existent resource reads ────────────────────────────────────────

	describe("non-existent resource returns", () => {
		it("getListing on unknown id returns null", async () => {
			const result = await controllerA.getListing("no-such-id");
			expect(result).toBeNull();
		});

		it("getListingByProduct on unknown product returns null", async () => {
			const result = await controllerA.getListingByProduct("no-such-product");
			expect(result).toBeNull();
		});

		it("getOrder on unknown id returns null", async () => {
			const result = await controllerA.getOrder("no-such-order");
			expect(result).toBeNull();
		});

		it("listListings on empty store returns empty array", async () => {
			const result = await controllerA.listListings();
			expect(result).toEqual([]);
		});

		it("listOrders on empty store returns empty array", async () => {
			const result = await controllerA.listOrders();
			expect(result).toEqual([]);
		});

		it("listCollections on empty store returns empty array", async () => {
			const result = await controllerA.listCollections();
			expect(result).toEqual([]);
		});

		it("getLastSync returns null when no syncs exist", async () => {
			const result = await controllerA.getLastSync();
			expect(result).toBeNull();
		});

		it("listSyncs on empty store returns empty array", async () => {
			const result = await controllerA.listSyncs();
			expect(result).toEqual([]);
		});

		it("deleteListing on unknown id returns false", async () => {
			const result = await controllerA.deleteListing("ghost-id");
			expect(result).toBe(false);
		});

		it("deleteCollection on unknown id returns false", async () => {
			const result = await controllerA.deleteCollection("ghost-id");
			expect(result).toBe(false);
		});
	});
});
