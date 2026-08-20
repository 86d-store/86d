import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createEtsyController } from "../service-impl";

describe("etsy controller", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createEtsyController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createEtsyController(mockData);
	});

	// ── createListing ─────────────────────────────────────────────────

	describe("createListing", () => {
		it("creates a listing with defaults", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				title: "Handmade Mug",
				price: 24.99,
			});

			expect(listing.id).toBeTruthy();
			expect(listing.localProductId).toBe("prod-1");
			expect(listing.title).toBe("Handmade Mug");
			expect(listing.status).toBe("draft");
			expect(listing.state).toBe("draft");
			expect(listing.quantity).toBe(0);
			expect(listing.whoMadeIt).toBe("i-did");
			expect(listing.whenMadeIt).toBe("made_to_order");
			expect(listing.isSupply).toBe(false);
			expect(listing.materials).toEqual([]);
			expect(listing.tags).toEqual([]);
			expect(listing.views).toBe(0);
			expect(listing.favorites).toBe(0);
		});

		it("creates a listing with all fields", async () => {
			const renewal = new Date("2026-06-15");
			const listing = await controller.createListing({
				localProductId: "prod-2",
				etsyListingId: "etsy-12345",
				title: "Vintage Ring",
				description: "A beautiful vintage ring",
				status: "active",
				state: "active",
				price: 89.99,
				quantity: 5,
				renewalDate: renewal,
				whoMadeIt: "someone-else",
				whenMadeIt: "before_2000",
				isSupply: false,
				materials: ["silver", "gemstone"],
				tags: ["vintage", "ring", "jewelry"],
				taxonomyId: "tax-123",
				shippingProfileId: "ship-456",
			});

			expect(listing.etsyListingId).toBe("etsy-12345");
			expect(listing.description).toBe("A beautiful vintage ring");
			expect(listing.status).toBe("active");
			expect(listing.state).toBe("active");
			expect(listing.quantity).toBe(5);
			expect(listing.whoMadeIt).toBe("someone-else");
			expect(listing.whenMadeIt).toBe("before_2000");
			expect(listing.materials).toEqual(["silver", "gemstone"]);
			expect(listing.tags).toEqual(["vintage", "ring", "jewelry"]);
			expect(listing.renewalDate).toEqual(renewal);
		});

		it("each listing gets a unique id", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 10; i++) {
				const listing = await controller.createListing({
					localProductId: `p-${i}`,
					title: `Product ${i}`,
					price: 10,
				});
				ids.add(listing.id);
			}
			expect(ids.size).toBe(10);
		});

		it("creates listing with collective maker", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-3",
				title: "Collective Art",
				price: 50,
				whoMadeIt: "collective",
			});
			expect(listing.whoMadeIt).toBe("collective");
		});
	});

	// ── updateListing ─────────────────────────────────────────────────

	describe("updateListing", () => {
		it("updates specific fields only", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				title: "Original",
				price: 10,
				materials: ["wood"],
			});

			const updated = await controller.updateListing(listing.id, {
				title: "Updated",
				price: 15,
			});

			expect(updated?.title).toBe("Updated");
			expect(updated?.price).toBe(15);
			expect(updated?.materials).toEqual(["wood"]);
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.updateListing("missing", {
				title: "Nope",
			});
			expect(result).toBeNull();
		});

		it("updates materials and tags", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				title: "Widget",
				price: 10,
			});

			const updated = await controller.updateListing(listing.id, {
				materials: ["ceramic", "glaze"],
				tags: ["handmade", "pottery"],
			});

			expect(updated?.materials).toEqual(["ceramic", "glaze"]);
			expect(updated?.tags).toEqual(["handmade", "pottery"]);
		});

		it("updates Etsy-specific attributes", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				title: "Widget",
				price: 10,
			});

			const updated = await controller.updateListing(listing.id, {
				whoMadeIt: "someone-else",
				whenMadeIt: "2020_2024",
				isSupply: true,
			});

			expect(updated?.whoMadeIt).toBe("someone-else");
			expect(updated?.whenMadeIt).toBe("2020_2024");
			expect(updated?.isSupply).toBe(true);
		});

		it("updates updatedAt timestamp", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
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
				title: "Widget",
				price: 10,
			});

			expect(await controller.deleteListing(listing.id)).toBe(true);
			expect(await controller.deleteListing(listing.id)).toBe(false);
		});
	});

	// ── getListing / getListingByProduct ───────────────────────────────

	describe("getListing / getListingByProduct", () => {
		it("returns null for empty string id", async () => {
			expect(await controller.getListing("")).toBeNull();
		});

		it("finds listing by product id", async () => {
			await controller.createListing({
				localProductId: "prod-abc",
				title: "Product ABC",
				price: 25,
			});

			const found = await controller.getListingByProduct("prod-abc");
			expect(found).not.toBeNull();
			expect(found?.title).toBe("Product ABC");
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
				title: "Active",
				price: 10,
				status: "active",
			});
			await controller.createListing({
				localProductId: "p2",
				title: "Draft",
				price: 10,
			});

			const active = await controller.listListings({ status: "active" });
			expect(active).toHaveLength(1);
			expect(active[0].title).toBe("Active");
		});

		it("paginates correctly", async () => {
			for (let i = 0; i < 7; i++) {
				await controller.createListing({
					localProductId: `p-${i}`,
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

	// ── renewListing ──────────────────────────────────────────────────

	describe("renewListing", () => {
		it("renews a listing setting active status and renewal date", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				title: "Expired Item",
				price: 10,
				status: "expired",
			});

			const renewed = await controller.renewListing(listing.id);

			expect(renewed?.status).toBe("active");
			expect(renewed?.state).toBe("active");
			expect(renewed?.renewalDate).toBeInstanceOf(Date);

			const now = new Date();
			const expectedMin = new Date(now);
			expectedMin.setDate(expectedMin.getDate() + 119);
			expect(renewed?.renewalDate?.getTime()).toBeGreaterThan(
				expectedMin.getTime(),
			);
		});

		it("returns null for non-existent id", async () => {
			expect(await controller.renewListing("missing")).toBeNull();
		});

		it("can renew an already active listing", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				title: "Active Item",
				price: 10,
				status: "active",
			});

			const renewed = await controller.renewListing(listing.id);
			expect(renewed?.status).toBe("active");
			expect(renewed?.renewalDate).toBeInstanceOf(Date);
		});
	});

	// ── receiveOrder ──────────────────────────────────────────────────

	describe("receiveOrder", () => {
		it("creates an order with defaults", async () => {
			const order = await controller.receiveOrder({
				etsyReceiptId: "etsy-rcpt-123",
				items: [{ listingId: "l1", qty: 1 }],
				subtotal: 25,
				shippingCost: 5,
				etsyFee: 1.5,
				processingFee: 0.75,
				tax: 2.5,
				total: 34.75,
				shippingAddress: { city: "Portland" },
			});

			expect(order.id).toBeTruthy();
			expect(order.etsyReceiptId).toBe("etsy-rcpt-123");
			expect(order.status).toBe("open");
			expect(order.total).toBe(34.75);
			expect(order.etsyFee).toBe(1.5);
			expect(order.processingFee).toBe(0.75);
		});

		it("creates an order with gift message", async () => {
			const order = await controller.receiveOrder({
				etsyReceiptId: "etsy-rcpt-456",
				items: [],
				subtotal: 50,
				shippingCost: 10,
				etsyFee: 3,
				processingFee: 1.5,
				tax: 5,
				total: 69.5,
				shippingAddress: {},
				giftMessage: "Happy Birthday!",
				buyerName: "Jane Doe",
				buyerEmail: "jane@example.com",
			});

			expect(order.giftMessage).toBe("Happy Birthday!");
			expect(order.buyerName).toBe("Jane Doe");
			expect(order.buyerEmail).toBe("jane@example.com");
		});
	});

	// ── getOrder / shipOrder ──────────────────────────────────────────

	describe("getOrder / shipOrder", () => {
		it("returns null for non-existent order", async () => {
			expect(await controller.getOrder("missing")).toBeNull();
		});

		it("ships an order with tracking", async () => {
			const order = await controller.receiveOrder({
				etsyReceiptId: "etsy-rcpt-789",
				items: [],
				subtotal: 25,
				shippingCost: 5,
				etsyFee: 1.5,
				processingFee: 0.75,
				tax: 2.5,
				total: 34.75,
				shippingAddress: {},
			});

			const shipped = await controller.shipOrder(
				order.id,
				"9400111899223",
				"USPS",
			);

			expect(shipped?.status).toBe("shipped");
			expect(shipped?.trackingNumber).toBe("9400111899223");
			expect(shipped?.carrier).toBe("USPS");
			expect(shipped?.shipDate).toBeInstanceOf(Date);
		});

		it("returns null when shipping non-existent order", async () => {
			const result = await controller.shipOrder("missing", "TRACK", "USPS");
			expect(result).toBeNull();
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
				etsyReceiptId: "o1",
				items: [],
				subtotal: 10,
				shippingCost: 0,
				etsyFee: 0.5,
				processingFee: 0.25,
				tax: 0,
				total: 10.75,
				shippingAddress: {},
			});
			const o2 = await controller.receiveOrder({
				etsyReceiptId: "o2",
				items: [],
				subtotal: 20,
				shippingCost: 5,
				etsyFee: 1,
				processingFee: 0.5,
				tax: 2,
				total: 28.5,
				shippingAddress: {},
			});
			await controller.shipOrder(o2.id, "TRACK-1", "UPS");

			const open = await controller.listOrders({ status: "open" });
			expect(open).toHaveLength(1);

			const shipped = await controller.listOrders({ status: "shipped" });
			expect(shipped).toHaveLength(1);
		});
	});

	// ── receiveReview / listReviews / getAverageRating ─────────────────

	describe("receiveReview / listReviews / getAverageRating", () => {
		it("creates a review", async () => {
			const review = await controller.receiveReview({
				etsyTransactionId: "txn-123",
				rating: 5,
				review: "Love it!",
				buyerName: "Jane",
				listingId: "listing-1",
			});

			expect(review.id).toBeTruthy();
			expect(review.rating).toBe(5);
			expect(review.review).toBe("Love it!");
			expect(review.buyerName).toBe("Jane");
		});

		it("creates a review without optional fields", async () => {
			const review = await controller.receiveReview({
				etsyTransactionId: "txn-456",
				rating: 4,
			});

			expect(review.rating).toBe(4);
			expect(review.review).toBeUndefined();
			expect(review.buyerName).toBeUndefined();
		});

		it("lists reviews with pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.receiveReview({
					etsyTransactionId: `txn-${i}`,
					rating: (i % 5) + 1,
				});
			}

			const page1 = await controller.listReviews({ take: 3 });
			expect(page1).toHaveLength(3);
		});

		it("returns 0 average when no reviews exist", async () => {
			const avg = await controller.getAverageRating();
			expect(avg).toBe(0);
		});

		it("calculates correct average rating", async () => {
			await controller.receiveReview({
				etsyTransactionId: "txn-1",
				rating: 5,
			});
			await controller.receiveReview({
				etsyTransactionId: "txn-2",
				rating: 4,
			});
			await controller.receiveReview({
				etsyTransactionId: "txn-3",
				rating: 3,
			});

			const avg = await controller.getAverageRating();
			expect(avg).toBe(4);
		});

		it("rounds average to two decimal places", async () => {
			await controller.receiveReview({
				etsyTransactionId: "txn-1",
				rating: 5,
			});
			await controller.receiveReview({
				etsyTransactionId: "txn-2",
				rating: 4,
			});
			await controller.receiveReview({
				etsyTransactionId: "txn-3",
				rating: 4,
			});

			const avg = await controller.getAverageRating();
			expect(avg).toBe(4.33);
		});
	});

	// ── getChannelStats ───────────────────────────────────────────────

	describe("getChannelStats", () => {
		it("returns zero stats when empty", async () => {
			const stats = await controller.getChannelStats();
			expect(stats.totalListings).toBe(0);
			expect(stats.totalOrders).toBe(0);
			expect(stats.totalRevenue).toBe(0);
			expect(stats.averageRating).toBe(0);
		});

		it("counts listings by status and calculates totals", async () => {
			await controller.createListing({
				localProductId: "p1",
				title: "Active 1",
				price: 10,
				status: "active",
			});
			await controller.createListing({
				localProductId: "p2",
				title: "Draft",
				price: 20,
			});
			await controller.createListing({
				localProductId: "p3",
				title: "Expired",
				price: 30,
				status: "expired",
			});

			await controller.receiveOrder({
				etsyReceiptId: "o1",
				items: [],
				subtotal: 50,
				shippingCost: 5,
				etsyFee: 3,
				processingFee: 1.5,
				tax: 5,
				total: 64.5,
				shippingAddress: {},
			});

			await controller.receiveReview({
				etsyTransactionId: "txn-1",
				rating: 5,
			});
			await controller.receiveReview({
				etsyTransactionId: "txn-2",
				rating: 3,
			});

			const stats = await controller.getChannelStats();
			expect(stats.totalListings).toBe(3);
			expect(stats.active).toBe(1);
			expect(stats.draft).toBe(1);
			expect(stats.expired).toBe(1);
			expect(stats.totalOrders).toBe(1);
			expect(stats.totalRevenue).toBe(64.5);
			expect(stats.averageRating).toBe(4);
			expect(stats.totalReviews).toBe(2);
		});
	});

	// ── getExpiringListings ───────────────────────────────────────────

	describe("getExpiringListings", () => {
		it("returns empty when no listings expire soon", async () => {
			await controller.createListing({
				localProductId: "p1",
				title: "Active",
				price: 10,
				status: "active",
			});

			const expiring = await controller.getExpiringListings(30);
			expect(expiring).toHaveLength(0);
		});

		it("finds listings expiring within the given days", async () => {
			const listing = await controller.createListing({
				localProductId: "p1",
				title: "Expiring Soon",
				price: 10,
				status: "active",
			});

			const inTenDays = new Date();
			inTenDays.setDate(inTenDays.getDate() + 10);
			await controller.updateListing(listing.id, {
				renewalDate: inTenDays,
			});

			const expiring = await controller.getExpiringListings(30);
			expect(expiring).toHaveLength(1);
			expect(expiring[0].title).toBe("Expiring Soon");
		});

		it("does not include already expired listings", async () => {
			const listing = await controller.createListing({
				localProductId: "p1",
				title: "Already Expired",
				price: 10,
				status: "active",
			});

			const pastDate = new Date();
			pastDate.setDate(pastDate.getDate() - 5);
			await controller.updateListing(listing.id, {
				renewalDate: pastDate,
			});

			const expiring = await controller.getExpiringListings(30);
			expect(expiring).toHaveLength(0);
		});

		it("does not include draft listings", async () => {
			const listing = await controller.createListing({
				localProductId: "p1",
				title: "Draft Listing",
				price: 10,
			});

			const inFiveDays = new Date();
			inFiveDays.setDate(inFiveDays.getDate() + 5);
			await controller.updateListing(listing.id, {
				renewalDate: inFiveDays,
			});

			const expiring = await controller.getExpiringListings(30);
			expect(expiring).toHaveLength(0);
		});

		it("respects the daysAhead parameter", async () => {
			const listing = await controller.createListing({
				localProductId: "p1",
				title: "Expiring In 20 Days",
				price: 10,
				status: "active",
			});

			const in20Days = new Date();
			in20Days.setDate(in20Days.getDate() + 20);
			await controller.updateListing(listing.id, {
				renewalDate: in20Days,
			});

			const within10 = await controller.getExpiringListings(10);
			expect(within10).toHaveLength(0);

			const within30 = await controller.getExpiringListings(30);
			expect(within30).toHaveLength(1);
		});
	});

	// ── lifecycle / edge cases ────────────────────────────────────────

	describe("lifecycle edge cases", () => {
		it("full listing lifecycle", async () => {
			const listing = await controller.createListing({
				localProductId: "prod-1",
				title: "Handmade Bowl",
				price: 35,
			});

			expect((await controller.getListing(listing.id))?.title).toBe(
				"Handmade Bowl",
			);

			const updated = await controller.updateListing(listing.id, {
				status: "active",
				state: "active",
				quantity: 10,
			});
			expect(updated?.status).toBe("active");

			const renewed = await controller.renewListing(listing.id);
			expect(renewed?.renewalDate).toBeInstanceOf(Date);

			expect(await controller.deleteListing(listing.id)).toBe(true);
			expect(await controller.getListing(listing.id)).toBeNull();
		});

		it("full order lifecycle", async () => {
			const order = await controller.receiveOrder({
				etsyReceiptId: "etsy-001",
				items: [{ listingId: "l1", qty: 2 }],
				subtotal: 70,
				shippingCost: 8,
				etsyFee: 4.2,
				processingFee: 2.1,
				tax: 7,
				total: 91.3,
				shippingAddress: { city: "Portland" },
			});

			expect(order.status).toBe("open");

			const shipped = await controller.shipOrder(
				order.id,
				"9400111899223",
				"USPS",
			);
			expect(shipped?.status).toBe("shipped");

			const fetched = await controller.getOrder(order.id);
			expect(fetched?.trackingNumber).toBe("9400111899223");
		});

		it("concurrent creates produce distinct listings", async () => {
			const promises = Array.from({ length: 10 }, (_, i) =>
				controller.createListing({
					localProductId: `p-${i}`,
					title: `Product ${i}`,
					price: 10,
				}),
			);
			const listings = await Promise.all(promises);
			const ids = new Set(listings.map((l) => l.id));
			expect(ids.size).toBe(10);
		});
	});
});
