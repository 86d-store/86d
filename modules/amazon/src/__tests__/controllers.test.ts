import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAmazonController } from "../service-impl";

describe("amazon controller", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAmazonController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAmazonController(mockData);
	});

	// ── createListing ─────────────────────────────────────────────────

	describe("createListing", () => {
		it("creates a listing with defaults", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget",
				price: 29.99,
			});

			expect(listing.id).toBeTruthy();
			expect(listing.localProductId).toBe("prod-1");
			expect(listing.sku).toBe("SKU-001");
			expect(listing.status).toBe("incomplete");
			expect(listing.fulfillmentChannel).toBe("FBM");
			expect(listing.quantity).toBe(0);
			expect(listing.condition).toBe("new");
			expect(listing.buyBoxOwned).toBe(false);
			expect(listing.metadata).toEqual({});
		});

		it("creates a listing with all fields", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-2",
				asin: "B08N5WRWNW",
				sku: "SKU-002",
				title: "Gadget",
				status: "active",
				fulfillmentChannel: "FBA",
				price: 49.99,
				quantity: 100,
				condition: "refurbished",
				buyBoxOwned: true,
				metadata: { brand: "Acme" },
			});

			expect(listing.asin).toBe("B08N5WRWNW");
			expect(listing.status).toBe("active");
			expect(listing.fulfillmentChannel).toBe("FBA");
			expect(listing.quantity).toBe(100);
			expect(listing.condition).toBe("refurbished");
			expect(listing.buyBoxOwned).toBe(true);
			expect(listing.metadata).toEqual({ brand: "Acme" });
		});

		it("each listing gets a unique id", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 10; i++) {
				const listing = await controller.createListing({
					localProductId: `p-${i}`,
					sku: `SKU-${i}`,
					title: `Product ${i}`,
					price: 10,
				});
				ids.add(listing.id);
			}
			expect(ids.size).toBe(10);
		});
	});

	// ── updateListing ─────────────────────────────────────────────────

	describe("updateListing", () => {
		it("updates specific fields only", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Original",
				price: 10,
			});

			const updated = await controller.updateListing(listing.id, {
				title: "Updated",
				price: 15,
			});

			expect(updated?.title).toBe("Updated");
			expect(updated?.price).toBe(15);
			expect(updated?.sku).toBe("SKU-001");
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.updateListing("missing", {
				title: "Nope",
			});
			expect(result).toBeNull();
		});

		it("updates fulfillment channel", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget",
				price: 10,
			});

			const updated = await controller.updateListing(listing.id, {
				fulfillmentChannel: "FBA",
			});
			expect(updated?.fulfillmentChannel).toBe("FBA");
		});

		it("updates condition", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget",
				price: 10,
			});

			const updated = await controller.updateListing(listing.id, {
				condition: "used-very-good",
			});
			expect(updated?.condition).toBe("used-very-good");
		});

		it("updates updatedAt timestamp", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget",
				price: 10,
			});

			const updated = await controller.updateListing(listing.id, {
				price: 20,
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				listing.updatedAt.getTime(),
			);
		});
	});

	// ── deleteListing ─────────────────────────────────────────────────

	describe("deleteListing", () => {
		it("deletes existing listing", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget",
				price: 10,
			});

			expect(await controller.deleteListing(listing.id)).toBe(true);
			expect(await controller.getListing(listing.id)).toBeNull();
		});

		it("returns false for non-existent id", async () => {
			expect(await controller.deleteListing("missing")).toBe(false);
		});

		it("double deletion returns false", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget",
				price: 10,
			});

			expect(await controller.deleteListing(listing.id)).toBe(true);
			expect(await controller.deleteListing(listing.id)).toBe(false);
		});
	});

	// ── getListing / getListingByProduct / getListingByAsin ────────────

	describe("getListing / getListingByProduct / getListingByAsin", () => {
		it("returns null for empty string id", async () => {
			expect(await controller.getListing("")).toBeNull();
		});

		it("finds listing by product id", async () => {
			await controller.createListing({
				localProductId: "prod-abc",
				sku: "SKU-ABC",
				title: "Product ABC",
				price: 25,
			});

			const found = await controller.getListingByProduct("prod-abc");
			expect(found).not.toBeNull();
			expect(found?.title).toBe("Product ABC");
		});

		it("finds listing by ASIN", async () => {
			await controller.createListing({
				localProductId: "prod-1",
				asin: "B08N5WRWNW",
				sku: "SKU-001",
				title: "Widget",
				price: 10,
			});

			const found = await controller.getListingByAsin("B08N5WRWNW");
			expect(found).not.toBeNull();
			expect(found?.sku).toBe("SKU-001");
		});

		it("returns null for non-existent ASIN", async () => {
			expect(await controller.getListingByAsin("NONEXIST")).toBeNull();
		});

		it("returns null for non-existent product id", async () => {
			expect(await controller.getListingByProduct("missing")).toBeNull();
		});
	});

	// ── listListings ──────────────────────────────────────────────────

	describe("listListings", () => {
		it("returns empty array when no listings exist", async () => {
			const listings = await controller.listListings();
			expect(listings).toHaveLength(0);
		});

		it("filters by status", async () => {
			await controller.createListing({
				localProductId: "p1",
				sku: "S1",
				title: "Active",
				price: 10,
				status: "active",
			});
			await controller.createListing({
				localProductId: "p2",
				sku: "S2",
				title: "Suppressed",
				price: 10,
				status: "suppressed",
			});

			const active = await controller.listListings({ status: "active" });
			expect(active).toHaveLength(1);
			expect(active[0].title).toBe("Active");
		});

		it("filters by fulfillment channel", async () => {
			await controller.createListing({
				localProductId: "p1",
				sku: "S1",
				title: "FBA Item",
				price: 10,
				fulfillmentChannel: "FBA",
			});
			await controller.createListing({
				localProductId: "p2",
				sku: "S2",
				title: "FBM Item",
				price: 10,
			});

			const fba = await controller.listListings({
				fulfillmentChannel: "FBA",
			});
			expect(fba).toHaveLength(1);
			expect(fba[0].title).toBe("FBA Item");
		});

		it("paginates correctly", async () => {
			for (let i = 0; i < 7; i++) {
				await controller.createListing({
					localProductId: `p-${i}`,
					sku: `S-${i}`,
					title: `Product ${i}`,
					price: 10,
				});
			}

			const page1 = await controller.listListings({ take: 3, skip: 0 });
			const page2 = await controller.listListings({ take: 3, skip: 3 });
			const page3 = await controller.listListings({ take: 3, skip: 6 });
			expect(page1).toHaveLength(3);
			expect(page2).toHaveLength(3);
			expect(page3).toHaveLength(1);
		});
	});

	// ── syncInventory / getLastInventorySync ──────────────────────────

	describe("syncInventory / getLastInventorySync", () => {
		it("creates inventory sync with listing count", async () => {
			await controller.createListing({
				localProductId: "p1",
				sku: "S1",
				title: "Widget",
				price: 10,
			});
			await controller.createListing({
				localProductId: "p2",
				sku: "S2",
				title: "Gadget",
				price: 20,
			});

			const sync = await controller.syncInventory();
			expect(sync.totalSkus).toBe(2);
			expect(sync.status).toBe("pending");
		});

		it("returns null when no syncs exist", async () => {
			expect(await controller.getLastInventorySync()).toBeNull();
		});

		it("returns the most recent sync", async () => {
			await controller.syncInventory();
			await controller.syncInventory();
			const last = await controller.getLastInventorySync();
			expect(last).not.toBeNull();
			expect(last?.id).toBeTruthy();
		});
	});

	// ── receiveOrder ──────────────────────────────────────────────────

	describe("receiveOrder", () => {
		it("creates an order with defaults", async () => {
			const order = await controller.receiveOrder({
				amazonOrderId: "111-222-333",
				items: [{ sku: "A", qty: 2 }],
				orderTotal: 59.98,
				shippingTotal: 5.99,
				marketplaceFee: 8.99,
				netProceeds: 44.99,
				shippingAddress: { city: "Seattle" },
			});

			expect(order.id).toBeTruthy();
			expect(order.amazonOrderId).toBe("111-222-333");
			expect(order.status).toBe("pending");
			expect(order.fulfillmentChannel).toBe("FBM");
			expect(order.orderTotal).toBe(59.98);
			expect(order.netProceeds).toBe(44.99);
		});

		it("creates an FBA order", async () => {
			const order = await controller.receiveOrder({
				amazonOrderId: "444-555-666",
				fulfillmentChannel: "FBA",
				items: [],
				orderTotal: 100,
				shippingTotal: 0,
				marketplaceFee: 15,
				netProceeds: 85,
				shippingAddress: {},
			});

			expect(order.fulfillmentChannel).toBe("FBA");
		});
	});

	// ── getOrder / shipOrder / cancelOrder ─────────────────────────────

	describe("getOrder / shipOrder / cancelOrder", () => {
		it("returns null for non-existent order", async () => {
			expect(await controller.getOrder("missing")).toBeNull();
		});

		it("ships an order with tracking", async () => {
			const order = await controller.receiveOrder({
				amazonOrderId: "111-222-333",
				items: [],
				orderTotal: 50,
				shippingTotal: 5,
				marketplaceFee: 7.5,
				netProceeds: 37.5,
				shippingAddress: {},
			});

			const shipped = await controller.shipOrder(order.id, "1Z999AA1", "UPS");

			expect(shipped?.status).toBe("shipped");
			expect(shipped?.trackingNumber).toBe("1Z999AA1");
			expect(shipped?.carrier).toBe("UPS");
			expect(shipped?.shipDate).toBeInstanceOf(Date);
		});

		it("returns null when shipping non-existent order", async () => {
			const result = await controller.shipOrder("missing", "TRACK", "UPS");
			expect(result).toBeNull();
		});

		it("cancels an order", async () => {
			const order = await controller.receiveOrder({
				amazonOrderId: "777-888-999",
				items: [],
				orderTotal: 30,
				shippingTotal: 0,
				marketplaceFee: 4.5,
				netProceeds: 25.5,
				shippingAddress: {},
			});

			const cancelled = await controller.cancelOrder(order.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("returns null when cancelling non-existent order", async () => {
			expect(await controller.cancelOrder("missing")).toBeNull();
		});
	});

	// ── listOrders ────────────────────────────────────────────────────

	describe("listOrders", () => {
		it("returns empty array when no orders exist", async () => {
			const orders = await controller.listOrders();
			expect(orders).toHaveLength(0);
		});

		it("filters by status", async () => {
			await controller.receiveOrder({
				amazonOrderId: "o1",
				items: [],
				orderTotal: 10,
				shippingTotal: 0,
				marketplaceFee: 1.5,
				netProceeds: 8.5,
				shippingAddress: {},
			});
			const o2 = await controller.receiveOrder({
				amazonOrderId: "o2",
				items: [],
				orderTotal: 20,
				shippingTotal: 0,
				marketplaceFee: 3,
				netProceeds: 17,
				shippingAddress: {},
			});
			await controller.shipOrder(o2.id, "TRACK", "USPS");

			const pending = await controller.listOrders({ status: "pending" });
			expect(pending).toHaveLength(1);

			const shipped = await controller.listOrders({ status: "shipped" });
			expect(shipped).toHaveLength(1);
		});

		it("filters by fulfillment channel", async () => {
			await controller.receiveOrder({
				amazonOrderId: "o1",
				fulfillmentChannel: "FBA",
				items: [],
				orderTotal: 10,
				shippingTotal: 0,
				marketplaceFee: 1.5,
				netProceeds: 8.5,
				shippingAddress: {},
			});
			await controller.receiveOrder({
				amazonOrderId: "o2",
				items: [],
				orderTotal: 20,
				shippingTotal: 0,
				marketplaceFee: 3,
				netProceeds: 17,
				shippingAddress: {},
			});

			const fba = await controller.listOrders({
				fulfillmentChannel: "FBA",
			});
			expect(fba).toHaveLength(1);
		});
	});

	// ── getChannelStats ───────────────────────────────────────────────

	describe("getChannelStats", () => {
		it("returns zero stats when empty", async () => {
			const stats = await controller.getChannelStats();
			expect(stats.totalListings).toBe(0);
			expect(stats.totalOrders).toBe(0);
			expect(stats.totalRevenue).toBe(0);
		});

		it("counts listings by status and channel", async () => {
			await controller.createListing({
				localProductId: "p1",
				sku: "S1",
				title: "Active FBA",
				price: 10,
				status: "active",
				fulfillmentChannel: "FBA",
			});
			await controller.createListing({
				localProductId: "p2",
				sku: "S2",
				title: "Active FBM",
				price: 20,
				status: "active",
			});
			await controller.createListing({
				localProductId: "p3",
				sku: "S3",
				title: "Suppressed",
				price: 30,
				status: "suppressed",
			});

			await controller.receiveOrder({
				amazonOrderId: "o1",
				items: [],
				orderTotal: 50,
				shippingTotal: 5,
				marketplaceFee: 7.5,
				netProceeds: 37.5,
				shippingAddress: {},
			});

			const stats = await controller.getChannelStats();
			expect(stats.totalListings).toBe(3);
			expect(stats.active).toBe(2);
			expect(stats.suppressed).toBe(1);
			expect(stats.fba).toBe(1);
			expect(stats.fbm).toBe(2);
			expect(stats.totalOrders).toBe(1);
			expect(stats.totalRevenue).toBe(50);
		});
	});

	// ── getInventoryHealth ────────────────────────────────────────────

	describe("getInventoryHealth", () => {
		it("returns zero health when empty", async () => {
			const health = await controller.getInventoryHealth();
			expect(health.totalSkus).toBe(0);
			expect(health.lowStock).toBe(0);
			expect(health.outOfStock).toBe(0);
		});

		it("identifies low stock and out of stock", async () => {
			await controller.createListing({
				localProductId: "p1",
				sku: "S1",
				title: "Out of Stock",
				price: 10,
				quantity: 0,
			});
			await controller.createListing({
				localProductId: "p2",
				sku: "S2",
				title: "Low Stock",
				price: 10,
				quantity: 3,
			});
			await controller.createListing({
				localProductId: "p3",
				sku: "S3",
				title: "Healthy Stock",
				price: 10,
				quantity: 50,
			});
			await controller.createListing({
				localProductId: "p4",
				sku: "S4",
				title: "Boundary Low",
				price: 10,
				quantity: 5,
			});

			const health = await controller.getInventoryHealth();
			expect(health.totalSkus).toBe(4);
			expect(health.outOfStock).toBe(1);
			expect(health.lowStock).toBe(2);
		});

		it("counts FBA vs FBM correctly", async () => {
			await controller.createListing({
				localProductId: "p1",
				sku: "S1",
				title: "FBA",
				price: 10,
				fulfillmentChannel: "FBA",
			});
			await controller.createListing({
				localProductId: "p2",
				sku: "S2",
				title: "FBM 1",
				price: 10,
			});
			await controller.createListing({
				localProductId: "p3",
				sku: "S3",
				title: "FBM 2",
				price: 10,
			});

			const health = await controller.getInventoryHealth();
			expect(health.fbaCount).toBe(1);
			expect(health.fbmCount).toBe(2);
		});
	});

	// ── lifecycle / edge cases ────────────────────────────────────────

	describe("lifecycle edge cases", () => {
		it("full listing lifecycle", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget",
				price: 29.99,
			});

			expect((await controller.getListing(listing.id))?.title).toBe("Widget");

			const updated = await controller.updateListing(listing.id, {
				status: "active",
				quantity: 50,
			});
			expect(updated?.status).toBe("active");

			expect(await controller.deleteListing(listing.id)).toBe(true);
			expect(await controller.getListing(listing.id)).toBeNull();
		});

		it("full order lifecycle", async () => {
			const order = await controller.receiveOrder({
				amazonOrderId: "AMZ-001",
				items: [{ sku: "SKU-001", qty: 1 }],
				orderTotal: 29.99,
				shippingTotal: 4.99,
				marketplaceFee: 4.5,
				netProceeds: 20.5,
				shippingAddress: { city: "Portland" },
			});

			expect(order.status).toBe("pending");

			const shipped = await controller.shipOrder(order.id, "1Z999AA1", "UPS");
			expect(shipped?.status).toBe("shipped");

			const fetched = await controller.getOrder(order.id);
			expect(fetched?.trackingNumber).toBe("1Z999AA1");
		});

		it("concurrent creates produce distinct listings", async () => {
			const promises = Array.from({ length: 10 }, (_, i) =>
				controller.createListing({
					localProductId: `p-${i}`,
					sku: `S-${i}`,
					title: `Product ${i}`,
					price: 10,
				}),
			);
			const listings = await Promise.all(promises);
			const ids = new Set(listings.map((l) => l.id));
			expect(ids.size).toBe(10);
		});

		it("deleting a listing does not affect orders", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget",
				price: 10,
			});

			const order = await controller.receiveOrder({
				amazonOrderId: "AMZ-002",
				items: [{ sku: listing.sku }],
				orderTotal: 10,
				shippingTotal: 0,
				marketplaceFee: 1.5,
				netProceeds: 8.5,
				shippingAddress: {},
			});

			await controller.deleteListing(listing.id);
			const fetchedOrder = await controller.getOrder(order.id);
			expect(fetchedOrder).not.toBeNull();
			expect(fetchedOrder?.amazonOrderId).toBe("AMZ-002");
		});
	});
});
