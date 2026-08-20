import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEtsyController } from "../service-impl";

// ── Provider mock ──────────────────────────────────────────────────────────

const mockProvider = {
	createListing: vi.fn(),
	updateListing: vi.fn(),
	getListings: vi.fn(),
	getReceipts: vi.fn(),
	getReviews: vi.fn(),
};

vi.mock("../provider", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../provider")>();

	function MockEtsyProvider() {
		return mockProvider;
	}

	return {
		...actual,
		EtsyProvider: MockEtsyProvider,
	};
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("etsy service-impl", () => {
	let mockData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		mockData = createMockDataService();
		vi.clearAllMocks();
	});

	function controllerWithProvider() {
		return createEtsyController(mockData, undefined, {
			apiKey: "etsy-key",
			shopId: "12345",
			accessToken: "token-abc",
		});
	}

	function controllerWithoutProvider() {
		return createEtsyController(mockData);
	}

	// ── Listing CRUD ─────────────────────────────────────────────────

	describe("listing CRUD", () => {
		it("creates a listing with defaults", async () => {
			const ctrl = controllerWithoutProvider();
			const listing = await ctrl.createListing({
				localProductId: "prod-1",
				title: "Handmade Mug",
				description: "A nice mug",
				price: 24.99,
			});

			expect(listing.id).toBeDefined();
			expect(listing.status).toBe("draft");
			expect(listing.state).toBe("draft");
			expect(listing.quantity).toBe(0);
			expect(listing.whoMadeIt).toBe("i-did");
			expect(listing.isSupply).toBe(false);
			expect(listing.views).toBe(0);
			expect(listing.favorites).toBe(0);
		});

		it("updates a listing partially", async () => {
			const ctrl = controllerWithoutProvider();
			const listing = await ctrl.createListing({
				localProductId: "prod-2",
				title: "Original",
				description: "Desc",
				price: 10,
			});

			const updated = await ctrl.updateListing(listing.id, {
				title: "Updated",
				price: 15,
				tags: ["mug", "handmade"],
			});

			expect(updated?.title).toBe("Updated");
			expect(updated?.price).toBe(15);
			expect(updated?.tags).toEqual(["mug", "handmade"]);
			expect(updated?.description).toBe("Desc");
		});

		it("returns null when updating non-existent listing", async () => {
			const ctrl = controllerWithoutProvider();
			const result = await ctrl.updateListing("non-existent", {
				title: "Nope",
			});
			expect(result).toBeNull();
		});

		it("deletes a listing", async () => {
			const ctrl = controllerWithoutProvider();
			const listing = await ctrl.createListing({
				localProductId: "prod-3",
				title: "Delete Me",
				description: "Bye",
				price: 5,
			});

			expect(await ctrl.deleteListing(listing.id)).toBe(true);
			expect(await ctrl.getListing(listing.id)).toBeNull();
		});

		it("returns false for deleting non-existent listing", async () => {
			const ctrl = controllerWithoutProvider();
			expect(await ctrl.deleteListing("non-existent")).toBe(false);
		});

		it("gets listing by product ID", async () => {
			const ctrl = controllerWithoutProvider();
			await ctrl.createListing({
				localProductId: "prod-4",
				title: "Findable",
				description: "D",
				price: 10,
			});

			const found = await ctrl.getListingByProduct("prod-4");
			expect(found?.title).toBe("Findable");
		});

		it("lists listings with status filter", async () => {
			const ctrl = controllerWithoutProvider();
			await ctrl.createListing({
				localProductId: "p1",
				title: "Active",
				description: "D",
				price: 10,
				status: "active",
			});
			await ctrl.createListing({
				localProductId: "p2",
				title: "Draft",
				description: "D",
				price: 20,
			});

			const active = await ctrl.listListings({ status: "active" });
			expect(active).toHaveLength(1);
		});
	});

	// ── Renewal ──────────────────────────────────────────────────────

	describe("renewListing", () => {
		it("renews a listing with 120-day expiry", async () => {
			const ctrl = controllerWithoutProvider();
			const listing = await ctrl.createListing({
				localProductId: "prod-renew",
				title: "Renew Me",
				description: "D",
				price: 15,
				status: "expired",
			});

			const renewed = await ctrl.renewListing(listing.id);
			expect(renewed?.status).toBe("active");
			expect(renewed?.state).toBe("active");
			expect(renewed?.renewalDate).toBeInstanceOf(Date);

			if (!renewed?.renewalDate) throw new Error("expected renewalDate");
			const daysDiff =
				(renewed.renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
			expect(daysDiff).toBeGreaterThan(119);
			expect(daysDiff).toBeLessThan(121);
		});

		it("returns null for non-existent listing", async () => {
			const ctrl = controllerWithoutProvider();
			expect(await ctrl.renewListing("non-existent")).toBeNull();
		});
	});

	// ── Orders ───────────────────────────────────────────────────────

	describe("order operations", () => {
		it("receives an order", async () => {
			const ctrl = controllerWithoutProvider();
			const order = await ctrl.receiveOrder({
				etsyReceiptId: "REC-001",
				items: [{ title: "Mug", quantity: 2, price: 24.99 }],
				subtotal: 49.98,
				shippingCost: 5.0,
				etsyFee: 3.0,
				processingFee: 1.5,
				tax: 4.5,
				total: 58.98,
				buyerName: "Jane",
				shippingAddress: { city: "Portland", state: "OR" },
			});

			expect(order.id).toBeDefined();
			expect(order.status).toBe("open");
			expect(order.etsyReceiptId).toBe("REC-001");
		});

		it("ships an order", async () => {
			const ctrl = controllerWithoutProvider();
			const order = await ctrl.receiveOrder({
				etsyReceiptId: "REC-SHIP",
				items: [],
				subtotal: 10,
				shippingCost: 5,
				etsyFee: 1,
				processingFee: 0.5,
				tax: 0,
				total: 16.5,
				buyerName: "Bob",
				shippingAddress: {},
			});

			const shipped = await ctrl.shipOrder(order.id, "9400111899223", "USPS");

			expect(shipped?.status).toBe("shipped");
			expect(shipped?.trackingNumber).toBe("9400111899223");
			expect(shipped?.carrier).toBe("USPS");
			expect(shipped?.shipDate).toBeInstanceOf(Date);
		});

		it("lists orders with status filter", async () => {
			const ctrl = controllerWithoutProvider();
			await ctrl.receiveOrder({
				etsyReceiptId: "R1",
				items: [],
				subtotal: 10,
				shippingCost: 5,
				etsyFee: 1,
				processingFee: 0.5,
				tax: 0,
				total: 16.5,
				buyerName: "A",
				shippingAddress: {},
				status: "paid",
			});
			await ctrl.receiveOrder({
				etsyReceiptId: "R2",
				items: [],
				subtotal: 20,
				shippingCost: 5,
				etsyFee: 2,
				processingFee: 1,
				tax: 0,
				total: 28,
				buyerName: "B",
				shippingAddress: {},
			});

			const paid = await ctrl.listOrders({ status: "paid" });
			expect(paid).toHaveLength(1);
		});
	});

	// ── Reviews ──────────────────────────────────────────────────────

	describe("reviews", () => {
		it("receives and lists reviews", async () => {
			const ctrl = controllerWithoutProvider();
			await ctrl.receiveReview({
				etsyTransactionId: "T1",
				rating: 5,
				review: "Love it!",
				buyerName: "Alice",
			});
			await ctrl.receiveReview({
				etsyTransactionId: "T2",
				rating: 3,
				buyerName: "Bob",
			});

			const reviews = await ctrl.listReviews();
			expect(reviews).toHaveLength(2);
		});

		it("computes average rating", async () => {
			const ctrl = controllerWithoutProvider();
			await ctrl.receiveReview({
				etsyTransactionId: "T1",
				rating: 5,
				buyerName: "A",
			});
			await ctrl.receiveReview({
				etsyTransactionId: "T2",
				rating: 3,
				buyerName: "B",
			});

			const avg = await ctrl.getAverageRating();
			expect(avg).toBe(4);
		});

		it("returns 0 average when no reviews exist", async () => {
			const ctrl = controllerWithoutProvider();
			expect(await ctrl.getAverageRating()).toBe(0);
		});
	});

	// ── Channel stats ────────────────────────────────────────────────

	describe("getChannelStats", () => {
		it("aggregates listing, order, and review stats", async () => {
			const ctrl = controllerWithoutProvider();

			await ctrl.createListing({
				localProductId: "p1",
				title: "Active Item",
				description: "D",
				price: 20,
				status: "active",
			});
			await ctrl.createListing({
				localProductId: "p2",
				title: "Draft Item",
				description: "D",
				price: 10,
			});

			await ctrl.receiveOrder({
				etsyReceiptId: "R1",
				items: [],
				subtotal: 20,
				shippingCost: 5,
				etsyFee: 1,
				processingFee: 0.5,
				tax: 2,
				total: 28.5,
				buyerName: "A",
				shippingAddress: {},
			});

			await ctrl.receiveReview({
				etsyTransactionId: "T1",
				rating: 4,
				buyerName: "A",
			});

			const stats = await ctrl.getChannelStats();
			expect(stats.totalListings).toBe(2);
			expect(stats.active).toBe(1);
			expect(stats.draft).toBe(1);
			expect(stats.totalOrders).toBe(1);
			expect(stats.totalRevenue).toBe(28.5);
			expect(stats.totalReviews).toBe(1);
			expect(stats.averageRating).toBe(4);
		});
	});

	// ── Expiring listings ────────────────────────────────────────────

	describe("getExpiringListings", () => {
		it("finds listings expiring within N days", async () => {
			const ctrl = controllerWithoutProvider();

			// Expiring in 10 days
			const soon = new Date();
			soon.setDate(soon.getDate() + 10);
			await ctrl.createListing({
				localProductId: "p1",
				title: "Expiring Soon",
				description: "D",
				price: 10,
				status: "active",
				renewalDate: soon,
			});

			// Expiring in 60 days
			const later = new Date();
			later.setDate(later.getDate() + 60);
			await ctrl.createListing({
				localProductId: "p2",
				title: "Not Yet",
				description: "D",
				price: 20,
				status: "active",
				renewalDate: later,
			});

			const expiring = await ctrl.getExpiringListings(30);
			expect(expiring).toHaveLength(1);
			expect(expiring[0].title).toBe("Expiring Soon");
		});
	});

	// ── pushListing with provider ────────────────────────────────────

	describe("pushListing", () => {
		it("creates a new Etsy listing when no etsyListingId", async () => {
			const ctrl = controllerWithProvider();
			const listing = await ctrl.createListing({
				localProductId: "p1",
				title: "New Item",
				description: "A new handmade item",
				price: 29.99,
				quantity: 5,
			});

			mockProvider.createListing.mockResolvedValue({
				listing_id: 987654321,
				state: "active",
				views: 0,
				num_favorers: 0,
			});

			const pushed = await ctrl.pushListing(listing.id);
			expect(pushed?.etsyListingId).toBe("987654321");
			expect(pushed?.status).toBe("active");
		});

		it("updates an existing Etsy listing when etsyListingId is set", async () => {
			const ctrl = controllerWithProvider();
			const listing = await ctrl.createListing({
				localProductId: "p2",
				etsyListingId: "111222333",
				title: "Updated Item",
				description: "Updated desc",
				price: 34.99,
				quantity: 3,
			});

			mockProvider.updateListing.mockResolvedValue({
				listing_id: 111222333,
				state: "active",
				views: 150,
				num_favorers: 12,
			});

			const pushed = await ctrl.pushListing(listing.id);
			expect(pushed?.views).toBe(150);
			expect(pushed?.favorites).toBe(12);
		});

		it("returns null without provider", async () => {
			const ctrl = controllerWithoutProvider();
			const listing = await ctrl.createListing({
				localProductId: "p3",
				title: "No Push",
				description: "D",
				price: 10,
			});

			expect(await ctrl.pushListing(listing.id)).toBeNull();
		});
	});

	// ── syncListings ─────────────────────────────────────────────────

	describe("syncListings", () => {
		it("returns zero without provider", async () => {
			const ctrl = controllerWithoutProvider();
			expect((await ctrl.syncListings()).synced).toBe(0);
		});

		it("syncs listings from Etsy API", async () => {
			const ctrl = controllerWithProvider();

			mockProvider.getListings.mockResolvedValue({
				results: [
					{
						listing_id: 1001,
						title: "Etsy Mug",
						description: "A mug from Etsy",
						state: "active",
						price: { amount: 2499, divisor: 100 },
						quantity: 10,
						who_made: "i_did",
						when_made: "made_to_order",
						is_supply: false,
						materials: ["ceramic"],
						tags: ["mug"],
						taxonomy_id: 123,
						shipping_profile_id: 456,
						views: 50,
						num_favorers: 5,
						creation_tsz: 1700000000,
						ending_tsz: 1710000000,
					},
				],
			});

			const result = await ctrl.syncListings();
			expect(result.synced).toBe(1);
		});
	});

	// ── syncOrders ───────────────────────────────────────────────────

	describe("syncOrders", () => {
		it("returns zero without provider", async () => {
			const ctrl = controllerWithoutProvider();
			expect((await ctrl.syncOrders()).synced).toBe(0);
		});

		it("syncs receipts from Etsy API", async () => {
			const ctrl = controllerWithProvider();

			mockProvider.getReceipts.mockResolvedValue({
				results: [
					{
						receipt_id: 2001,
						status: "paid",
						is_shipped: false,
						transactions: [
							{
								transaction_id: 3001,
								listing_id: 1001,
								title: "Mug",
								quantity: 1,
								price: { amount: 2499, divisor: 100 },
							},
						],
						subtotal: { amount: 2499, divisor: 100 },
						total_shipping_cost: { amount: 500, divisor: 100 },
						total_tax_cost: { amount: 200, divisor: 100 },
						total_price: { amount: 3199, divisor: 100 },
						name: "Customer Name",
						buyer_email: "buyer@example.com",
						first_line: "123 Main St",
						second_line: null,
						city: "Portland",
						state: "OR",
						zip: "97201",
						country_iso: "US",
						gift_message: null,
						shipping_tracking_code: null,
						shipping_carrier: null,
						shipped_date: null,
						create_timestamp: 1700000000,
					},
				],
			});

			const result = await ctrl.syncOrders();
			expect(result.synced).toBe(1);
		});
	});

	// ── syncReviews ──────────────────────────────────────────────────

	describe("syncReviews", () => {
		it("returns zero without provider", async () => {
			const ctrl = controllerWithoutProvider();
			expect((await ctrl.syncReviews()).synced).toBe(0);
		});

		it("syncs reviews from Etsy API", async () => {
			const ctrl = controllerWithProvider();

			mockProvider.getReviews.mockResolvedValue({
				results: [
					{
						transaction_id: 4001,
						rating: 5,
						review: "Beautiful work!",
						listing_id: 1001,
						create_timestamp: 1700000000,
					},
				],
			});

			const result = await ctrl.syncReviews();
			expect(result.synced).toBe(1);
		});
	});
});
