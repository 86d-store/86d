import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createInstagramShopController } from "../service-impl";

describe("instagram-shop endpoint security", () => {
	let mockDataA: ReturnType<typeof createMockDataService>;
	let mockDataB: ReturnType<typeof createMockDataService>;
	let controllerA: ReturnType<typeof createInstagramShopController>;
	let controllerB: ReturnType<typeof createInstagramShopController>;

	beforeEach(() => {
		mockDataA = createMockDataService();
		mockDataB = createMockDataService();
		controllerA = createInstagramShopController(mockDataA);
		controllerB = createInstagramShopController(mockDataB);
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

		it("updateListing in store A does not bleed into store B", async () => {
			const listingA = await controllerA.createListing({
				localProductId: "prod-1",
				title: "Original",
			});
			await controllerA.updateListing(listingA.id, { title: "Updated" });

			const resultB = await controllerB.getListing(listingA.id);
			expect(resultB).toBeNull();
		});

		it("deleteListing in store A does not remove store B listings", async () => {
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

	// ── Data isolation: media tags ─────────────────────────────────────────

	describe("data isolation – media tags", () => {
		it("tagProduct in store A does not affect store B listings", async () => {
			const listingA = await controllerA.createListing({
				localProductId: "prod-1",
				title: "Store A Product",
			});

			// tagging in A
			await controllerA.tagProduct(listingA.id, "media-001");

			// store B has no such listing
			const tagsB = await controllerB.getProductTags(listingA.id);
			expect(tagsB).toEqual([]);
		});

		it("getProductTags on unknown listing returns empty array not an error", async () => {
			const tags = await controllerA.getProductTags("ghost-listing-id");
			expect(tags).toEqual([]);
		});

		it("tagProduct on another store's listing returns null", async () => {
			const listingA = await controllerA.createListing({
				localProductId: "prod-1",
				title: "Store A Product",
			});

			const result = await controllerB.tagProduct(listingA.id, "media-001");
			expect(result).toBeNull();
		});

		it("untagProduct on another store's listing returns null", async () => {
			const listingA = await controllerA.createListing({
				localProductId: "prod-1",
				title: "Store A Product",
			});
			await controllerA.tagProduct(listingA.id, "media-001");

			const result = await controllerB.untagProduct(listingA.id, "media-001");
			expect(result).toBeNull();
		});
	});

	// ── Data isolation: orders ─────────────────────────────────────────────

	describe("data isolation – orders", () => {
		it("order received in store A is not visible in store B", async () => {
			await controllerA.receiveOrder({
				externalOrderId: "ext-order-1",
				instagramOrderId: "ig-order-1",
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
				externalOrderId: "ext-order-1",
				instagramOrderId: "ig-order-1",
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

		it("updateOrderStatus via wrong store returns null", async () => {
			const orderA = await controllerA.receiveOrder({
				externalOrderId: "ext-order-1",
				instagramOrderId: "ig-order-1",
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

	// ── Data isolation: channel stats ──────────────────────────────────────

	describe("data isolation – channel stats", () => {
		it("stats from store A do not bleed into store B", async () => {
			await controllerA.createListing({
				localProductId: "prod-1",
				title: "Active",
				status: "active",
			});
			await controllerA.receiveOrder({
				externalOrderId: "ext-order-1",
				instagramOrderId: "ig-order-1",
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
		it("updateOrderStatus on a non-existent order returns null", async () => {
			const result = await controllerA.updateOrderStatus(
				"ghost-order-id",
				"shipped",
			);
			expect(result).toBeNull();
		});

		it("cannot transition an order belonging to another store", async () => {
			const orderA = await controllerA.receiveOrder({
				externalOrderId: "ext-order-1",
				instagramOrderId: "ig-order-1",
				items: [],
				subtotal: 50,
				shippingFee: 5,
				platformFee: 2,
				total: 57,
				shippingAddress: {},
			});
			await controllerA.updateOrderStatus(orderA.id, "cancelled");

			// Store B must not be able to "ship" store A's order
			const result = await controllerB.updateOrderStatus(
				orderA.id,
				"shipped",
				"TRK001",
			);
			expect(result).toBeNull();
		});

		it("status transitions within the same store operate on the correct order", async () => {
			const order = await controllerA.receiveOrder({
				externalOrderId: "ext-order-1",
				instagramOrderId: "ig-order-1",
				items: [],
				subtotal: 50,
				shippingFee: 5,
				platformFee: 2,
				total: 57,
				shippingAddress: {},
			});

			const confirmed = await controllerA.updateOrderStatus(
				order.id,
				"confirmed",
			);
			expect(confirmed?.status).toBe("confirmed");
			expect(confirmed?.id).toBe(order.id);
		});

		it("refunding an order via wrong store returns null, not an error", async () => {
			const orderA = await controllerA.receiveOrder({
				externalOrderId: "ext-order-1",
				instagramOrderId: "ig-order-1",
				items: [],
				subtotal: 50,
				shippingFee: 5,
				platformFee: 2,
				total: 57,
				shippingAddress: {},
			});
			await controllerA.updateOrderStatus(orderA.id, "delivered");

			const result = await controllerB.updateOrderStatus(orderA.id, "refunded");
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
				title: "Gone",
			});
			await controllerA.createListing({
				localProductId: "prod-2",
				title: "Remaining",
			});

			await controllerA.deleteListing(listing.id);

			const listings = await controllerA.listListings();
			expect(listings).toHaveLength(1);
			expect(listings[0]?.localProductId).toBe("prod-2");
		});

		it("deleted listing cannot be found by getListingByProduct", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-gone",
				title: "Gone",
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

		it("deleted listing media tags return empty array", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-1",
				title: "Tagged Product",
			});
			await controllerA.tagProduct(listing.id, "media-001");
			await controllerA.deleteListing(listing.id);

			const tags = await controllerA.getProductTags(listing.id);
			expect(tags).toEqual([]);
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

		it("stats reflect deletion – listing count decrements after delete", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-1",
				title: "Product",
				status: "active",
			});

			const before = await controllerA.getChannelStats();
			expect(before.totalListings).toBe(1);

			await controllerA.deleteListing(listing.id);

			const after = await controllerA.getChannelStats();
			expect(after.totalListings).toBe(0);
			expect(after.activeListings).toBe(0);
		});
	});

	// ── Non-existent resource returns ──────────────────────────────────────

	describe("non-existent resource returns", () => {
		it("getListing on unknown id returns null", async () => {
			expect(await controllerA.getListing("no-such-id")).toBeNull();
		});

		it("getListingByProduct on unknown product returns null", async () => {
			expect(
				await controllerA.getListingByProduct("no-such-product"),
			).toBeNull();
		});

		it("getOrder on unknown id returns null", async () => {
			expect(await controllerA.getOrder("no-such-order")).toBeNull();
		});

		it("listListings on empty store returns empty array", async () => {
			expect(await controllerA.listListings()).toEqual([]);
		});

		it("listOrders on empty store returns empty array", async () => {
			expect(await controllerA.listOrders()).toEqual([]);
		});

		it("getLastSync returns null when no syncs exist", async () => {
			expect(await controllerA.getLastSync()).toBeNull();
		});

		it("listSyncs on empty store returns empty array", async () => {
			expect(await controllerA.listSyncs()).toEqual([]);
		});

		it("deleteListing on unknown id returns false", async () => {
			expect(await controllerA.deleteListing("ghost-id")).toBe(false);
		});
	});
});
