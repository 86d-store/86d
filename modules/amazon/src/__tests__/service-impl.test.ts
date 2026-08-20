import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAmazonController } from "../service-impl";

// ── Provider mock ──────────────────────────────────────────────────────────

const mockProvider = {
	getListing: vi.fn(),
	putListing: vi.fn(),
	deleteListing: vi.fn(),
	searchListings: vi.fn(),
	getOrders: vi.fn(),
	getOrderItems: vi.fn(),
	confirmShipment: vi.fn(),
};

vi.mock("../provider", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../provider")>();

	function MockAmazonProvider() {
		return mockProvider;
	}

	return {
		...actual,
		AmazonProvider: MockAmazonProvider,
	};
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("amazon service-impl", () => {
	let mockData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		mockData = createMockDataService();
		vi.clearAllMocks();
	});

	function controllerWithProvider() {
		return createAmazonController(mockData, undefined, {
			sellerId: "A123",
			clientId: "client-id",
			clientSecret: "client-secret",
			refreshToken: "refresh-token",
			marketplaceId: "ATVPDKIKX0DER",
			region: "na",
		});
	}

	function controllerWithoutProvider() {
		return createAmazonController(mockData);
	}

	// ── Listing CRUD ─────────────────────────────────────────────────

	describe("listing CRUD", () => {
		it("creates a listing with defaults", async () => {
			const ctrl = controllerWithoutProvider();
			const listing = await ctrl.createListing({
				localProductId: "prod-1",
				sku: "SKU-001",
				title: "Widget",
				price: 19.99,
			});

			expect(listing.id).toBeDefined();
			expect(listing.status).toBe("incomplete");
			expect(listing.fulfillmentChannel).toBe("FBM");
			expect(listing.quantity).toBe(0);
			expect(listing.condition).toBe("new");
			expect(listing.buyBoxOwned).toBe(false);
		});

		it("creates a listing with custom params", async () => {
			const ctrl = controllerWithoutProvider();
			const listing = await ctrl.createListing({
				localProductId: "prod-2",
				asin: "B0TESTCODE",
				sku: "SKU-002",
				title: "Gadget",
				status: "active",
				fulfillmentChannel: "FBA",
				price: 29.99,
				quantity: 50,
				condition: "refurbished",
				buyBoxOwned: true,
			});

			expect(listing.asin).toBe("B0TESTCODE");
			expect(listing.status).toBe("active");
			expect(listing.fulfillmentChannel).toBe("FBA");
			expect(listing.quantity).toBe(50);
			expect(listing.condition).toBe("refurbished");
			expect(listing.buyBoxOwned).toBe(true);
		});

		it("updates a listing partially", async () => {
			const ctrl = controllerWithoutProvider();
			const listing = await ctrl.createListing({
				localProductId: "prod-3",
				sku: "SKU-003",
				title: "Original",
				price: 10,
			});

			const updated = await ctrl.updateListing(listing.id, {
				title: "Updated",
				price: 15,
			});

			expect(updated?.title).toBe("Updated");
			expect(updated?.price).toBe(15);
			expect(updated?.sku).toBe("SKU-003"); // unchanged
		});

		it("returns null when updating non-existent listing", async () => {
			const ctrl = controllerWithoutProvider();
			const result = await ctrl.updateListing("non-existent", {
				title: "Nope",
			});
			expect(result).toBeNull();
		});

		it("gets listing by product ID", async () => {
			const ctrl = controllerWithoutProvider();
			await ctrl.createListing({
				localProductId: "prod-4",
				sku: "SKU-004",
				title: "Findable",
				price: 5,
			});

			const found = await ctrl.getListingByProduct("prod-4");
			expect(found?.title).toBe("Findable");
		});

		it("gets listing by ASIN", async () => {
			const ctrl = controllerWithoutProvider();
			await ctrl.createListing({
				localProductId: "prod-5",
				asin: "B0FINDABLE",
				sku: "SKU-005",
				title: "ASIN Findable",
				price: 5,
			});

			const found = await ctrl.getListingByAsin("B0FINDABLE");
			expect(found?.title).toBe("ASIN Findable");
		});

		it("lists listings with filters", async () => {
			const ctrl = controllerWithoutProvider();
			await ctrl.createListing({
				localProductId: "p1",
				sku: "S1",
				title: "Active",
				price: 10,
				status: "active",
				fulfillmentChannel: "FBA",
			});
			await ctrl.createListing({
				localProductId: "p2",
				sku: "S2",
				title: "Inactive",
				price: 20,
				status: "inactive",
				fulfillmentChannel: "FBM",
			});

			const active = await ctrl.listListings({ status: "active" });
			expect(active).toHaveLength(1);

			const fba = await ctrl.listListings({ fulfillmentChannel: "FBA" });
			expect(fba).toHaveLength(1);
		});
	});

	// ── deleteListing with provider ──────────────────────────────────

	describe("deleteListing with provider", () => {
		it("calls provider.deleteListing when credentials exist", async () => {
			const ctrl = controllerWithProvider();
			const listing = await ctrl.createListing({
				localProductId: "prod-del",
				sku: "SKU-DEL",
				title: "Delete Me",
				price: 10,
			});

			mockProvider.deleteListing.mockResolvedValue({});

			const result = await ctrl.deleteListing(listing.id);
			expect(result).toBe(true);
			expect(mockProvider.deleteListing).toHaveBeenCalledWith("SKU-DEL");
		});

		it("deletes locally even if API call fails", async () => {
			const ctrl = controllerWithProvider();
			const listing = await ctrl.createListing({
				localProductId: "prod-del-err",
				sku: "SKU-DEL-ERR",
				title: "Error Delete",
				price: 10,
			});

			mockProvider.deleteListing.mockRejectedValue(new Error("API error"));

			const result = await ctrl.deleteListing(listing.id);
			expect(result).toBe(true);
			expect(await ctrl.getListing(listing.id)).toBeNull();
		});

		it("returns false for non-existent listing", async () => {
			const ctrl = controllerWithoutProvider();
			const result = await ctrl.deleteListing("non-existent");
			expect(result).toBe(false);
		});
	});

	// ── syncInventory with provider ──────────────────────────────────

	describe("syncInventory", () => {
		it("returns pending sync when no provider", async () => {
			const ctrl = controllerWithoutProvider();
			await ctrl.createListing({
				localProductId: "p1",
				sku: "S1",
				title: "T",
				price: 10,
			});

			const sync = await ctrl.syncInventory();
			expect(sync.status).toBe("pending");
			expect(sync.totalSkus).toBe(1);
		});

		it("updates listings from API data", async () => {
			const ctrl = controllerWithProvider();
			const listing = await ctrl.createListing({
				localProductId: "p1",
				sku: "SKU-SYNC",
				title: "Sync Me",
				price: 10,
				quantity: 0,
			});

			mockProvider.getListing.mockResolvedValue({
				fulfillmentAvailability: [
					{
						fulfillmentChannelCode: "AFN",
						quantity: 42,
					},
				],
			});

			const sync = await ctrl.syncInventory();
			expect(sync.status).toBe("synced");
			expect(sync.updatedSkus).toBe(1);
			expect(sync.failedSkus).toBe(0);

			const updated = await ctrl.getListing(listing.id);
			expect(updated?.quantity).toBe(42);
			expect(updated?.fulfillmentChannel).toBe("FBA");
		});

		it("records failed SKUs when API call fails", async () => {
			const ctrl = controllerWithProvider();
			await ctrl.createListing({
				localProductId: "p1",
				sku: "SKU-FAIL",
				title: "Fail",
				price: 10,
			});

			mockProvider.getListing.mockRejectedValue(new Error("Item not found"));

			const sync = await ctrl.syncInventory();
			expect(sync.status).toBe("failed");
			expect(sync.failedSkus).toBe(1);
		});
	});

	// ── pushListing with provider ────────────────────────────────────

	describe("pushListing", () => {
		it("pushes listing to Amazon and updates ASIN", async () => {
			const ctrl = controllerWithProvider();
			const listing = await ctrl.createListing({
				localProductId: "p1",
				sku: "SKU-PUSH",
				title: "Push Me",
				price: 19.99,
				quantity: 10,
			});

			mockProvider.putListing.mockResolvedValue({
				identifiers: [{ asin: "B0NEWASIN" }],
				issues: [],
				status: "ACCEPTED",
				submissionId: "sub-123",
			});

			const pushed = await ctrl.pushListing(listing.id);
			expect(pushed?.asin).toBe("B0NEWASIN");
			expect(pushed?.status).toBe("active");
		});

		it("marks listing as suppressed when API returns errors", async () => {
			const ctrl = controllerWithProvider();
			const listing = await ctrl.createListing({
				localProductId: "p2",
				sku: "SKU-ERR",
				title: "Bad Listing",
				price: 0,
			});

			mockProvider.putListing.mockResolvedValue({
				identifiers: [],
				issues: [
					{ severity: "ERROR", message: "Price must be greater than 0" },
				],
				status: "INVALID",
				submissionId: "sub-456",
			});

			const pushed = await ctrl.pushListing(listing.id);
			expect(pushed?.status).toBe("suppressed");
			expect(pushed?.error).toContain("Price must be greater than 0");
		});

		it("returns existing listing without provider", async () => {
			const ctrl = controllerWithoutProvider();
			const listing = await ctrl.createListing({
				localProductId: "p3",
				sku: "SKU-NOPROVIDER",
				title: "No Push",
				price: 10,
			});

			const result = await ctrl.pushListing(listing.id);
			expect(result?.id).toBe(listing.id);
		});

		it("returns null for non-existent listing", async () => {
			const ctrl = controllerWithProvider();
			const result = await ctrl.pushListing("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── Order operations ─────────────────────────────────────────────

	describe("order operations", () => {
		it("receives an order", async () => {
			const ctrl = controllerWithoutProvider();
			const order = await ctrl.receiveOrder({
				amazonOrderId: "AMZ-001",
				items: [{ asin: "B0TEST", title: "Item", quantity: 1 }],
				orderTotal: 2999,
				shippingTotal: 500,
				marketplaceFee: 450,
				netProceeds: 2049,
				buyerName: "John Doe",
				shippingAddress: { line1: "123 Main St", city: "Anytown", state: "CA" },
			});

			expect(order.id).toBeDefined();
			expect(order.status).toBe("pending");
			expect(order.amazonOrderId).toBe("AMZ-001");
		});

		it("ships an order with provider", async () => {
			const ctrl = controllerWithProvider();
			const order = await ctrl.receiveOrder({
				amazonOrderId: "AMZ-SHIP",
				items: [],
				orderTotal: 1000,
				shippingTotal: 0,
				marketplaceFee: 150,
				netProceeds: 850,
				shippingAddress: {},
			});

			mockProvider.confirmShipment.mockResolvedValue(undefined);

			const shipped = await ctrl.shipOrder(
				order.id,
				"1Z999AA10123456784",
				"UPS",
			);

			expect(shipped?.status).toBe("shipped");
			expect(shipped?.trackingNumber).toBe("1Z999AA10123456784");
			expect(shipped?.carrier).toBe("UPS");
			expect(mockProvider.confirmShipment).toHaveBeenCalledWith(
				"AMZ-SHIP",
				expect.objectContaining({
					trackingNumber: "1Z999AA10123456784",
					carrierCode: "UPS",
				}),
			);
		});

		it("returns null when shipping non-existent order", async () => {
			const ctrl = controllerWithProvider();
			const result = await ctrl.shipOrder("non-existent", "123", "UPS");
			expect(result).toBeNull();
		});

		it("cancels an order", async () => {
			const ctrl = controllerWithoutProvider();
			const order = await ctrl.receiveOrder({
				amazonOrderId: "AMZ-CANCEL",
				items: [],
				orderTotal: 500,
				shippingTotal: 0,
				marketplaceFee: 75,
				netProceeds: 425,
				shippingAddress: {},
			});

			const cancelled = await ctrl.cancelOrder(order.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("lists orders with filters", async () => {
			const ctrl = controllerWithoutProvider();
			await ctrl.receiveOrder({
				amazonOrderId: "AMZ-O1",
				items: [],
				orderTotal: 1000,
				shippingTotal: 0,
				marketplaceFee: 150,
				netProceeds: 850,
				status: "pending",
				shippingAddress: {},
			});
			await ctrl.receiveOrder({
				amazonOrderId: "AMZ-O2",
				items: [],
				orderTotal: 2000,
				shippingTotal: 0,
				marketplaceFee: 300,
				netProceeds: 1700,
				status: "shipped",
				fulfillmentChannel: "FBA",
				shippingAddress: {},
			});

			const pending = await ctrl.listOrders({ status: "pending" });
			expect(pending).toHaveLength(1);

			const fba = await ctrl.listOrders({ fulfillmentChannel: "FBA" });
			expect(fba).toHaveLength(1);
		});
	});

	// ── syncListings with provider ───────────────────────────────────

	describe("syncListings", () => {
		it("returns zero synced without provider", async () => {
			const ctrl = controllerWithoutProvider();
			const result = await ctrl.syncListings();
			expect(result.synced).toBe(0);
		});

		it("syncs listings from Amazon with pagination", async () => {
			const ctrl = controllerWithProvider();

			mockProvider.searchListings
				.mockResolvedValueOnce({
					items: [
						{
							sku: "SKU-A",
							summaries: [
								{ asin: "B0ASIN_A", itemName: "Item A", status: ["BUYABLE"] },
							],
							offers: [{ price: { amount: "19.99" } }],
							fulfillmentAvailability: [
								{ fulfillmentChannelCode: "DEFAULT", quantity: 10 },
							],
						},
					],
					pagination: { nextToken: "page2" },
				})
				.mockResolvedValueOnce({
					items: [
						{
							sku: "SKU-B",
							summaries: [
								{
									asin: "B0ASIN_B",
									itemName: "Item B",
									status: ["DISCOVERABLE"],
								},
							],
							offers: [],
							fulfillmentAvailability: [],
						},
					],
					pagination: { nextToken: undefined },
				});

			const result = await ctrl.syncListings();
			expect(result.synced).toBe(2);
			expect(mockProvider.searchListings).toHaveBeenCalledTimes(2);

			// First item should be active
			const listingA = await ctrl.getListingByAsin("B0ASIN_A");
			expect(listingA?.status).toBe("active");
			expect(listingA?.price).toBe(19.99);

			// Second item should be inactive (not BUYABLE)
			const listingB = await ctrl.getListingByAsin("B0ASIN_B");
			expect(listingB?.status).toBe("inactive");
		});
	});

	// ── syncOrders with provider ─────────────────────────────────────

	describe("syncOrders", () => {
		it("returns zero synced without provider", async () => {
			const ctrl = controllerWithoutProvider();
			const result = await ctrl.syncOrders();
			expect(result.synced).toBe(0);
		});

		it("syncs orders from Amazon SP-API", async () => {
			const ctrl = controllerWithProvider();

			mockProvider.getOrders.mockResolvedValue({
				Orders: [
					{
						AmazonOrderId: "AMZ-SYNC-1",
						OrderStatus: "Shipped",
						FulfillmentChannel: "MFN",
						OrderTotal: { Amount: "29.99", CurrencyCode: "USD" },
						BuyerInfo: { BuyerName: "Jane Doe" },
						ShippingAddress: {
							Name: "Jane Doe",
							AddressLine1: "123 Main St",
							City: "Anytown",
							StateOrRegion: "CA",
							PostalCode: "90210",
							CountryCode: "US",
						},
					},
				],
				NextToken: undefined,
			});

			mockProvider.getOrderItems.mockResolvedValue([
				{
					ASIN: "B0TEST",
					SellerSKU: "SKU-T",
					Title: "Test Item",
					QuantityOrdered: 1,
					QuantityShipped: 1,
					ItemPrice: { Amount: "24.99", CurrencyCode: "USD" },
					ItemTax: { Amount: "2.50", CurrencyCode: "USD" },
					ShippingPrice: { Amount: "5.00", CurrencyCode: "USD" },
				},
			]);

			const result = await ctrl.syncOrders({
				createdAfter: "2026-03-20T00:00:00Z",
			});
			expect(result.synced).toBe(1);
		});
	});

	// ── Channel stats and inventory health ──────────────────────────

	describe("getChannelStats", () => {
		it("aggregates listing and order stats", async () => {
			const ctrl = controllerWithoutProvider();

			await ctrl.createListing({
				localProductId: "p1",
				sku: "S1",
				title: "A1",
				price: 10,
				status: "active",
				fulfillmentChannel: "FBA",
			});
			await ctrl.createListing({
				localProductId: "p2",
				sku: "S2",
				title: "A2",
				price: 20,
				status: "inactive",
				fulfillmentChannel: "FBM",
			});
			await ctrl.createListing({
				localProductId: "p3",
				sku: "S3",
				title: "A3",
				price: 15,
				status: "suppressed",
				fulfillmentChannel: "FBM",
			});

			await ctrl.receiveOrder({
				amazonOrderId: "O1",
				items: [],
				orderTotal: 2500,
				shippingTotal: 500,
				marketplaceFee: 375,
				netProceeds: 1625,
				shippingAddress: {},
			});

			const stats = await ctrl.getChannelStats();
			expect(stats.totalListings).toBe(3);
			expect(stats.active).toBe(1);
			expect(stats.inactive).toBe(1);
			expect(stats.suppressed).toBe(1);
			expect(stats.fba).toBe(1);
			expect(stats.fbm).toBe(2);
			expect(stats.totalOrders).toBe(1);
			expect(stats.totalRevenue).toBe(2500);
		});
	});

	describe("getInventoryHealth", () => {
		it("computes inventory health metrics", async () => {
			const ctrl = controllerWithoutProvider();

			await ctrl.createListing({
				localProductId: "p1",
				sku: "S1",
				title: "In Stock",
				price: 10,
				quantity: 50,
				fulfillmentChannel: "FBA",
			});
			await ctrl.createListing({
				localProductId: "p2",
				sku: "S2",
				title: "Low Stock",
				price: 20,
				quantity: 3,
				fulfillmentChannel: "FBM",
			});
			await ctrl.createListing({
				localProductId: "p3",
				sku: "S3",
				title: "Out of Stock",
				price: 15,
				quantity: 0,
				fulfillmentChannel: "FBA",
			});

			const health = await ctrl.getInventoryHealth();
			expect(health.totalSkus).toBe(3);
			expect(health.lowStock).toBe(1);
			expect(health.outOfStock).toBe(1);
			expect(health.fbaCount).toBe(2);
			expect(health.fbmCount).toBe(1);
		});
	});
});
