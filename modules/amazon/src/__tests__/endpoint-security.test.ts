import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAmazonController } from "../service-impl";

describe("amazon endpoint security", () => {
	let mockDataA: ReturnType<typeof createMockDataService>;
	let mockDataB: ReturnType<typeof createMockDataService>;
	let controllerA: ReturnType<typeof createAmazonController>;
	let controllerB: ReturnType<typeof createAmazonController>;

	beforeEach(() => {
		mockDataA = createMockDataService();
		mockDataB = createMockDataService();
		controllerA = createAmazonController(mockDataA);
		controllerB = createAmazonController(mockDataB);
	});

	// ── Data isolation ─────────────────────────────────────────────────

	describe("data isolation", () => {
		it("listings created in store A are not visible in store B", async () => {
			await controllerA.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget",
				price: 29.99,
			});
			const listingsB = await controllerB.listListings();
			expect(listingsB).toHaveLength(0);
		});

		it("listings created in store B are not visible in store A", async () => {
			await controllerB.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget",
				price: 29.99,
			});
			const listingsA = await controllerA.listListings();
			expect(listingsA).toHaveLength(0);
		});

		it("store A cannot retrieve a listing created in store B by id", async () => {
			const listing = await controllerB.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget",
				price: 29.99,
			});
			const result = await controllerA.getListing(listing.id);
			expect(result).toBeNull();
		});

		it("store A cannot update a listing owned by store B", async () => {
			const listing = await controllerB.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget",
				price: 29.99,
			});
			const result = await controllerA.updateListing(listing.id, {
				price: 9.99,
			});
			expect(result).toBeNull();
		});

		it("store A cannot delete a listing owned by store B", async () => {
			const listing = await controllerB.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget",
				price: 29.99,
			});
			const deleted = await controllerA.deleteListing(listing.id);
			expect(deleted).toBe(false);
			// Listing still accessible in store B
			const stillExists = await controllerB.getListing(listing.id);
			expect(stillExists).not.toBeNull();
		});

		it("orders received in store A are not visible in store B", async () => {
			await controllerA.receiveOrder({
				amazonOrderId: "AMZ-001",
				items: [],
				orderTotal: 100,
				shippingTotal: 10,
				marketplaceFee: 5,
				netProceeds: 85,
				shippingAddress: { city: "Seattle" },
			});
			const ordersB = await controllerB.listOrders();
			expect(ordersB).toHaveLength(0);
		});

		it("store A cannot retrieve an order owned by store B", async () => {
			const order = await controllerB.receiveOrder({
				amazonOrderId: "AMZ-001",
				items: [],
				orderTotal: 100,
				shippingTotal: 10,
				marketplaceFee: 5,
				netProceeds: 85,
				shippingAddress: { city: "Seattle" },
			});
			const result = await controllerA.getOrder(order.id);
			expect(result).toBeNull();
		});

		it("channel stats in store A do not reflect store B data", async () => {
			await controllerB.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget",
				price: 29.99,
				status: "active",
			});
			await controllerB.receiveOrder({
				amazonOrderId: "AMZ-001",
				items: [],
				orderTotal: 100,
				shippingTotal: 10,
				marketplaceFee: 5,
				netProceeds: 85,
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
				sku: "SKU-001",
				title: "Widget A",
				price: 10,
			});
			await controllerA.createListing({
				localProductId: "prod-2",
				sku: "SKU-002",
				title: "Widget A2",
				price: 20,
			});
			await controllerB.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget B",
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
				sku: "SKU-X",
				title: "Widget",
				price: 15,
			});
			const result = await controllerA.getListingByProduct("shared-prod-id");
			expect(result).toBeNull();
		});

		it("getListingByAsin does not cross store boundaries", async () => {
			await controllerB.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget",
				price: 15,
				asin: "B0SHARED001",
			});
			const result = await controllerA.getListingByAsin("B0SHARED001");
			expect(result).toBeNull();
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

		it("cancelOrder returns null for a non-existent order id", async () => {
			const result = await controllerA.cancelOrder("non-existent-id");
			expect(result).toBeNull();
		});

		it("shipOrder sets status to shipped and persists tracking info", async () => {
			const order = await controllerA.receiveOrder({
				amazonOrderId: "AMZ-SHIP-01",
				items: [],
				orderTotal: 50,
				shippingTotal: 5,
				marketplaceFee: 2,
				netProceeds: 43,
				shippingAddress: { city: "Portland" },
			});
			const shipped = await controllerA.shipOrder(order.id, "TRACK-001", "UPS");
			expect(shipped?.status).toBe("shipped");
			expect(shipped?.trackingNumber).toBe("TRACK-001");
			expect(shipped?.carrier).toBe("UPS");
			expect(shipped?.shipDate).toBeInstanceOf(Date);
		});

		it("cancelOrder sets status to cancelled", async () => {
			const order = await controllerA.receiveOrder({
				amazonOrderId: "AMZ-CANCEL-01",
				items: [],
				orderTotal: 50,
				shippingTotal: 5,
				marketplaceFee: 2,
				netProceeds: 43,
				shippingAddress: { city: "Portland" },
			});
			const cancelled = await controllerA.cancelOrder(order.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("getOrder reflects the latest status after shipOrder", async () => {
			const order = await controllerA.receiveOrder({
				amazonOrderId: "AMZ-SHIP-02",
				items: [],
				orderTotal: 75,
				shippingTotal: 8,
				marketplaceFee: 3,
				netProceeds: 64,
				shippingAddress: {},
			});
			await controllerA.shipOrder(order.id, "TRACK-PERSIST", "USPS");
			const fetched = await controllerA.getOrder(order.id);
			expect(fetched?.status).toBe("shipped");
			expect(fetched?.trackingNumber).toBe("TRACK-PERSIST");
		});

		it("shipOrder on store B order returns null in store A", async () => {
			const order = await controllerB.receiveOrder({
				amazonOrderId: "AMZ-CROSS-01",
				items: [],
				orderTotal: 40,
				shippingTotal: 4,
				marketplaceFee: 2,
				netProceeds: 34,
				shippingAddress: {},
			});
			const result = await controllerA.shipOrder(
				order.id,
				"TRACK-CROSS",
				"FedEx",
			);
			expect(result).toBeNull();
		});

		it("cancelOrder on store B order returns null in store A", async () => {
			const order = await controllerB.receiveOrder({
				amazonOrderId: "AMZ-CROSS-02",
				items: [],
				orderTotal: 40,
				shippingTotal: 4,
				marketplaceFee: 2,
				netProceeds: 34,
				shippingAddress: {},
			});
			const result = await controllerA.cancelOrder(order.id);
			expect(result).toBeNull();
		});
	});

	// ── Resource immutability after deletion ───────────────────────────

	describe("resource immutability", () => {
		it("deleted listing cannot be retrieved by id", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-del-1",
				sku: "SKU-DEL-1",
				title: "To Be Deleted",
				price: 9.99,
			});
			await controllerA.deleteListing(listing.id);
			const result = await controllerA.getListing(listing.id);
			expect(result).toBeNull();
		});

		it("deleted listing does not appear in listListings", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-del-2",
				sku: "SKU-DEL-2",
				title: "To Be Deleted 2",
				price: 19.99,
			});
			await controllerA.createListing({
				localProductId: "prod-keep-1",
				sku: "SKU-KEEP-1",
				title: "Keep Me",
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
				sku: "SKU-DEL-3",
				title: "Will Be Deleted",
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
				sku: "SKU-DEL-4",
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
				sku: "SKU-DEL-5",
				title: "Ghost Listing",
				price: 12.0,
			});
			await controllerA.deleteListing(listing.id);
			const result = await controllerA.getListingByProduct("prod-del-5");
			expect(result).toBeNull();
		});

		it("channel stats exclude deleted listings", async () => {
			const listing = await controllerA.createListing({
				localProductId: "prod-del-6",
				sku: "SKU-DEL-6",
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

		it("getListingByAsin returns null for non-existent asin", async () => {
			const result = await controllerA.getListingByAsin("B0NONE");
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

		it("channel stats return zero counts when store is empty", async () => {
			const stats = await controllerA.getChannelStats();
			expect(stats.totalListings).toBe(0);
			expect(stats.active).toBe(0);
			expect(stats.totalOrders).toBe(0);
			expect(stats.totalRevenue).toBe(0);
		});

		it("listOrders returns empty array for empty store", async () => {
			const orders = await controllerA.listOrders();
			expect(orders).toHaveLength(0);
		});

		it("listListings returns empty array for empty store", async () => {
			const listings = await controllerA.listListings();
			expect(listings).toHaveLength(0);
		});
	});
});
