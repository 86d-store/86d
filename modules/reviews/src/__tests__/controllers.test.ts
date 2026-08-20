import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createReviewController } from "../service-impl";

describe("review controller edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createReviewController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createReviewController(mockData);
	});

	// ── createReview edge cases ────────────────────────────────────────

	describe("createReview edge cases", () => {
		it("defaults to pending status when no options provided", async () => {
			const review = await controller.createReview({
				productId: "prod_1",
				authorName: "Alice",
				authorEmail: "alice@example.com",
				rating: 5,
				body: "Great product!",
			});
			expect(review.status).toBe("pending");
			expect(review.helpfulCount).toBe(0);
			expect(review.isVerifiedPurchase).toBe(false);
		});

		it("sets approved status when autoApprove option is true", async () => {
			const autoCtrl = createReviewController(mockData, {
				autoApprove: true,
			});
			const review = await autoCtrl.createReview({
				productId: "prod_1",
				authorName: "Bob",
				authorEmail: "bob@example.com",
				rating: 4,
				body: "Solid product.",
			});
			expect(review.status).toBe("approved");
		});

		it("keeps pending status when autoApprove is explicitly false", async () => {
			const ctrl = createReviewController(mockData, { autoApprove: false });
			const review = await ctrl.createReview({
				productId: "prod_1",
				authorName: "Carol",
				authorEmail: "carol@example.com",
				rating: 3,
				body: "Average.",
			});
			expect(review.status).toBe("pending");
		});

		it("each created review gets a unique id", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 20; i++) {
				const review = await controller.createReview({
					productId: `prod_${i}`,
					authorName: `Author ${i}`,
					authorEmail: `author${i}@example.com`,
					rating: (i % 5) + 1,
					body: `Review body ${i}`,
				});
				ids.add(review.id);
			}
			expect(ids.size).toBe(20);
		});

		it("preserves optional fields like title, customerId, and isVerifiedPurchase", async () => {
			const review = await controller.createReview({
				productId: "prod_1",
				authorName: "Dave",
				authorEmail: "dave@example.com",
				rating: 5,
				title: "Amazing!",
				body: "Best purchase ever.",
				customerId: "cust_1",
				isVerifiedPurchase: true,
			});
			expect(review.title).toBe("Amazing!");
			expect(review.customerId).toBe("cust_1");
			expect(review.isVerifiedPurchase).toBe(true);
		});

		it("createdAt and updatedAt are set to approximately current time", async () => {
			const before = new Date();
			const review = await controller.createReview({
				productId: "prod_1",
				authorName: "Eve",
				authorEmail: "eve@example.com",
				rating: 4,
				body: "Good.",
			});
			const after = new Date();
			expect(review.createdAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(review.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
			expect(review.updatedAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(review.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});
	});

	// ── getReview edge cases ───────────────────────────────────────────

	describe("getReview edge cases", () => {
		it("returns the review by id", async () => {
			const created = await controller.createReview({
				productId: "prod_1",
				authorName: "Alice",
				authorEmail: "alice@example.com",
				rating: 5,
				body: "Great!",
			});
			const fetched = await controller.getReview(created.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.id).toBe(created.id);
			expect(fetched?.authorName).toBe("Alice");
		});

		it("returns null for non-existent id", async () => {
			const fetched = await controller.getReview("non-existent-id");
			expect(fetched).toBeNull();
		});
	});

	// ── updateReviewStatus edge cases ──────────────────────────────────

	describe("updateReviewStatus edge cases", () => {
		it("updates status from pending to approved", async () => {
			const review = await controller.createReview({
				productId: "prod_1",
				authorName: "Alice",
				authorEmail: "alice@example.com",
				rating: 5,
				body: "Great!",
			});
			const updated = await controller.updateReviewStatus(
				review.id,
				"approved",
			);
			expect(updated?.status).toBe("approved");
		});

		it("attaches moderation note when provided", async () => {
			const review = await controller.createReview({
				productId: "prod_1",
				authorName: "Spammer",
				authorEmail: "spam@example.com",
				rating: 1,
				body: "Buy my product!",
			});
			const updated = await controller.updateReviewStatus(
				review.id,
				"rejected",
				"Spam content detected",
			);
			expect(updated?.status).toBe("rejected");
			expect(updated?.moderationNote).toBe("Spam content detected");
		});

		it("returns null for non-existent review", async () => {
			const result = await controller.updateReviewStatus(
				"non-existent",
				"approved",
			);
			expect(result).toBeNull();
		});

		it("updates updatedAt timestamp on status change", async () => {
			const review = await controller.createReview({
				productId: "prod_1",
				authorName: "Alice",
				authorEmail: "alice@example.com",
				rating: 4,
				body: "Good.",
			});
			const updated = await controller.updateReviewStatus(
				review.id,
				"approved",
			);
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				review.updatedAt.getTime(),
			);
		});
	});

	// ── deleteReview edge cases ────────────────────────────────────────

	describe("deleteReview edge cases", () => {
		it("returns true when review exists", async () => {
			const review = await controller.createReview({
				productId: "prod_1",
				authorName: "Alice",
				authorEmail: "alice@example.com",
				rating: 5,
				body: "Great!",
			});
			expect(await controller.deleteReview(review.id)).toBe(true);
		});

		it("returns false for non-existent review", async () => {
			expect(await controller.deleteReview("non-existent")).toBe(false);
		});

		it("double deletion returns false on second attempt", async () => {
			const review = await controller.createReview({
				productId: "prod_1",
				authorName: "Alice",
				authorEmail: "alice@example.com",
				rating: 5,
				body: "Great!",
			});
			expect(await controller.deleteReview(review.id)).toBe(true);
			expect(await controller.deleteReview(review.id)).toBe(false);
		});

		it("getReview returns null after deletion", async () => {
			const review = await controller.createReview({
				productId: "prod_1",
				authorName: "Alice",
				authorEmail: "alice@example.com",
				rating: 3,
				body: "OK.",
			});
			await controller.deleteReview(review.id);
			expect(await controller.getReview(review.id)).toBeNull();
		});
	});

	// ── addMerchantResponse edge cases ─────────────────────────────────

	describe("addMerchantResponse edge cases", () => {
		it("adds merchant response and sets merchantResponseAt", async () => {
			const review = await controller.createReview({
				productId: "prod_1",
				authorName: "Alice",
				authorEmail: "alice@example.com",
				rating: 2,
				body: "Not great.",
			});
			const before = new Date();
			const updated = await controller.addMerchantResponse(
				review.id,
				"Sorry to hear that! Please contact support.",
			);
			const after = new Date();
			expect(updated?.merchantResponse).toBe(
				"Sorry to hear that! Please contact support.",
			);
			expect(updated?.merchantResponseAt).toBeInstanceOf(Date);
			expect(updated?.merchantResponseAt?.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(updated?.merchantResponseAt?.getTime()).toBeLessThanOrEqual(
				after.getTime(),
			);
		});

		it("returns null for non-existent review", async () => {
			const result = await controller.addMerchantResponse(
				"non-existent",
				"Response text",
			);
			expect(result).toBeNull();
		});

		it("overwrites previous merchant response", async () => {
			const review = await controller.createReview({
				productId: "prod_1",
				authorName: "Bob",
				authorEmail: "bob@example.com",
				rating: 3,
				body: "Meh.",
			});
			await controller.addMerchantResponse(review.id, "First response");
			const updated = await controller.addMerchantResponse(
				review.id,
				"Updated response",
			);
			expect(updated?.merchantResponse).toBe("Updated response");
		});
	});

	// ── markHelpful edge cases ─────────────────────────────────────────

	describe("markHelpful edge cases", () => {
		it("increments helpfulCount by 1", async () => {
			const review = await controller.createReview({
				productId: "prod_1",
				authorName: "Alice",
				authorEmail: "alice@example.com",
				rating: 5,
				body: "Helpful review.",
			});
			expect(review.helpfulCount).toBe(0);
			const first = await controller.markHelpful(review.id);
			expect(first?.helpfulCount).toBe(1);
		});

		it("increments helpfulCount multiple times correctly", async () => {
			const review = await controller.createReview({
				productId: "prod_1",
				authorName: "Bob",
				authorEmail: "bob@example.com",
				rating: 4,
				body: "Very useful.",
			});
			await controller.markHelpful(review.id);
			await controller.markHelpful(review.id);
			const third = await controller.markHelpful(review.id);
			expect(third?.helpfulCount).toBe(3);
		});

		it("returns null for non-existent review", async () => {
			const result = await controller.markHelpful("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── getReviewAnalytics edge cases ──────────────────────────────────

	describe("getReviewAnalytics edge cases", () => {
		it("returns zeroes for empty store", async () => {
			const analytics = await controller.getReviewAnalytics();
			expect(analytics.totalReviews).toBe(0);
			expect(analytics.pendingCount).toBe(0);
			expect(analytics.approvedCount).toBe(0);
			expect(analytics.rejectedCount).toBe(0);
			expect(analytics.averageRating).toBe(0);
			expect(analytics.withMerchantResponse).toBe(0);
			expect(analytics.ratingsDistribution).toEqual({
				"1": 0,
				"2": 0,
				"3": 0,
				"4": 0,
				"5": 0,
			});
		});

		it("counts statuses and ratings correctly with multiple reviews", async () => {
			// Create reviews with various ratings and statuses
			const r1 = await controller.createReview({
				productId: "prod_1",
				authorName: "A",
				authorEmail: "a@example.com",
				rating: 5,
				body: "Perfect.",
			});
			await controller.createReview({
				productId: "prod_1",
				authorName: "B",
				authorEmail: "b@example.com",
				rating: 4,
				body: "Good.",
			});
			const r3 = await controller.createReview({
				productId: "prod_2",
				authorName: "C",
				authorEmail: "c@example.com",
				rating: 3,
				body: "OK.",
			});

			// Approve r1, reject r3, leave r2 pending
			await controller.updateReviewStatus(r1.id, "approved");
			await controller.updateReviewStatus(r3.id, "rejected");

			// Add merchant response to r1
			await controller.addMerchantResponse(r1.id, "Thank you!");

			const analytics = await controller.getReviewAnalytics();
			expect(analytics.totalReviews).toBe(3);
			expect(analytics.pendingCount).toBe(1);
			expect(analytics.approvedCount).toBe(1);
			expect(analytics.rejectedCount).toBe(1);
			expect(analytics.withMerchantResponse).toBe(1);
			// Average: (5+4+3)/3 = 4.0
			expect(analytics.averageRating).toBe(4);
			expect(analytics.ratingsDistribution).toEqual({
				"1": 0,
				"2": 0,
				"3": 1,
				"4": 1,
				"5": 1,
			});
		});

		it("averageRating rounds to 1 decimal place", async () => {
			// Create 3 reviews: ratings 5, 4, 4 => average = 13/3 = 4.333... => 4.3
			await controller.createReview({
				productId: "prod_1",
				authorName: "A",
				authorEmail: "a@example.com",
				rating: 5,
				body: "Great.",
			});
			await controller.createReview({
				productId: "prod_1",
				authorName: "B",
				authorEmail: "b@example.com",
				rating: 4,
				body: "Good.",
			});
			await controller.createReview({
				productId: "prod_1",
				authorName: "C",
				authorEmail: "c@example.com",
				rating: 4,
				body: "Decent.",
			});
			const analytics = await controller.getReviewAnalytics();
			expect(analytics.averageRating).toBe(4.3);
		});

		it("handles all 5-star ratings distribution", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createReview({
					productId: "prod_1",
					authorName: `User ${i}`,
					authorEmail: `user${i}@example.com`,
					rating: 5,
					body: "Perfect!",
				});
			}
			const analytics = await controller.getReviewAnalytics();
			expect(analytics.averageRating).toBe(5);
			expect(analytics.ratingsDistribution).toEqual({
				"1": 0,
				"2": 0,
				"3": 0,
				"4": 0,
				"5": 5,
			});
		});
	});

	// ── getProductRatingSummary edge cases ──────────────────────────────

	describe("getProductRatingSummary edge cases", () => {
		it("returns zero summary for product with no reviews", async () => {
			const summary = await controller.getProductRatingSummary("prod_none");
			expect(summary.average).toBe(0);
			expect(summary.count).toBe(0);
			expect(summary.distribution).toEqual({
				"1": 0,
				"2": 0,
				"3": 0,
				"4": 0,
				"5": 0,
			});
		});

		it("only counts approved reviews", async () => {
			const r1 = await controller.createReview({
				productId: "prod_1",
				authorName: "A",
				authorEmail: "a@example.com",
				rating: 5,
				body: "Great.",
			});
			const r2 = await controller.createReview({
				productId: "prod_1",
				authorName: "B",
				authorEmail: "b@example.com",
				rating: 1,
				body: "Terrible.",
			});
			await controller.createReview({
				productId: "prod_1",
				authorName: "C",
				authorEmail: "c@example.com",
				rating: 3,
				body: "Meh.",
			});

			// Approve only r1
			await controller.updateReviewStatus(r1.id, "approved");
			// Reject r2
			await controller.updateReviewStatus(r2.id, "rejected");
			// r3 stays pending

			const summary = await controller.getProductRatingSummary("prod_1");
			expect(summary.count).toBe(1);
			expect(summary.average).toBe(5);
			expect(summary.distribution["5"]).toBe(1);
			expect(summary.distribution["1"]).toBe(0);
			expect(summary.distribution["3"]).toBe(0);
		});

		it("calculates accurate distribution with mixed approved ratings", async () => {
			const autoCtrl = createReviewController(mockData, {
				autoApprove: true,
			});

			await autoCtrl.createReview({
				productId: "prod_1",
				authorName: "A",
				authorEmail: "a@example.com",
				rating: 5,
				body: "Perfect.",
			});
			await autoCtrl.createReview({
				productId: "prod_1",
				authorName: "B",
				authorEmail: "b@example.com",
				rating: 5,
				body: "Love it.",
			});
			await autoCtrl.createReview({
				productId: "prod_1",
				authorName: "C",
				authorEmail: "c@example.com",
				rating: 3,
				body: "Average.",
			});
			await autoCtrl.createReview({
				productId: "prod_1",
				authorName: "D",
				authorEmail: "d@example.com",
				rating: 1,
				body: "Bad.",
			});

			const summary = await autoCtrl.getProductRatingSummary("prod_1");
			expect(summary.count).toBe(4);
			// (5+5+3+1)/4 = 14/4 = 3.5
			expect(summary.average).toBe(3.5);
			expect(summary.distribution).toEqual({
				"1": 1,
				"2": 0,
				"3": 1,
				"4": 0,
				"5": 2,
			});
		});

		it("ignores reviews from other products", async () => {
			const autoCtrl = createReviewController(mockData, {
				autoApprove: true,
			});
			await autoCtrl.createReview({
				productId: "prod_1",
				authorName: "A",
				authorEmail: "a@example.com",
				rating: 5,
				body: "Great product 1.",
			});
			await autoCtrl.createReview({
				productId: "prod_2",
				authorName: "B",
				authorEmail: "b@example.com",
				rating: 1,
				body: "Bad product 2.",
			});

			const summary = await autoCtrl.getProductRatingSummary("prod_1");
			expect(summary.count).toBe(1);
			expect(summary.average).toBe(5);
		});
	});

	// ── listReviewsByProduct edge cases ─────────────────────────────────

	describe("listReviewsByProduct edge cases", () => {
		it("returns all reviews for a product without filters", async () => {
			await controller.createReview({
				productId: "prod_1",
				authorName: "A",
				authorEmail: "a@example.com",
				rating: 5,
				body: "Great.",
			});
			await controller.createReview({
				productId: "prod_1",
				authorName: "B",
				authorEmail: "b@example.com",
				rating: 3,
				body: "OK.",
			});
			await controller.createReview({
				productId: "prod_2",
				authorName: "C",
				authorEmail: "c@example.com",
				rating: 4,
				body: "Good.",
			});

			const reviews = await controller.listReviewsByProduct("prod_1");
			expect(reviews).toHaveLength(2);
			for (const r of reviews) {
				expect(r.productId).toBe("prod_1");
			}
		});

		it("filters by approvedOnly when set", async () => {
			const r1 = await controller.createReview({
				productId: "prod_1",
				authorName: "A",
				authorEmail: "a@example.com",
				rating: 5,
				body: "Great.",
			});
			await controller.createReview({
				productId: "prod_1",
				authorName: "B",
				authorEmail: "b@example.com",
				rating: 3,
				body: "OK.",
			});

			await controller.updateReviewStatus(r1.id, "approved");

			const approved = await controller.listReviewsByProduct("prod_1", {
				approvedOnly: true,
			});
			expect(approved).toHaveLength(1);
			expect(approved[0].status).toBe("approved");
		});

		it("supports pagination with take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createReview({
					productId: "prod_1",
					authorName: `Author ${i}`,
					authorEmail: `author${i}@example.com`,
					rating: 4,
					body: `Body ${i}`,
				});
			}
			const page1 = await controller.listReviewsByProduct("prod_1", {
				take: 2,
				skip: 0,
			});
			const page2 = await controller.listReviewsByProduct("prod_1", {
				take: 2,
				skip: 2,
			});
			const page3 = await controller.listReviewsByProduct("prod_1", {
				take: 2,
				skip: 4,
			});
			expect(page1).toHaveLength(2);
			expect(page2).toHaveLength(2);
			expect(page3).toHaveLength(1);
		});
	});

	// ── listReviews edge cases ─────────────────────────────────────────

	describe("listReviews edge cases", () => {
		it("returns all reviews without params", async () => {
			await controller.createReview({
				productId: "prod_1",
				authorName: "A",
				authorEmail: "a@example.com",
				rating: 5,
				body: "Great.",
			});
			await controller.createReview({
				productId: "prod_2",
				authorName: "B",
				authorEmail: "b@example.com",
				rating: 3,
				body: "OK.",
			});
			const all = await controller.listReviews();
			expect(all).toHaveLength(2);
		});

		it("filters by status", async () => {
			const r1 = await controller.createReview({
				productId: "prod_1",
				authorName: "A",
				authorEmail: "a@example.com",
				rating: 5,
				body: "Great.",
			});
			await controller.createReview({
				productId: "prod_2",
				authorName: "B",
				authorEmail: "b@example.com",
				rating: 2,
				body: "Meh.",
			});

			await controller.updateReviewStatus(r1.id, "approved");

			const approved = await controller.listReviews({ status: "approved" });
			expect(approved).toHaveLength(1);
			expect(approved[0].id).toBe(r1.id);
		});

		it("filters by productId", async () => {
			await controller.createReview({
				productId: "prod_1",
				authorName: "A",
				authorEmail: "a@example.com",
				rating: 5,
				body: "Great.",
			});
			await controller.createReview({
				productId: "prod_2",
				authorName: "B",
				authorEmail: "b@example.com",
				rating: 3,
				body: "OK.",
			});
			const filtered = await controller.listReviews({
				productId: "prod_1",
			});
			expect(filtered).toHaveLength(1);
			expect(filtered[0].productId).toBe("prod_1");
		});
	});

	// ── listReviewsByCustomer edge cases ────────────────────────────────

	describe("listReviewsByCustomer edge cases", () => {
		it("returns reviews and total for a customer", async () => {
			await controller.createReview({
				productId: "prod_1",
				authorName: "Alice",
				authorEmail: "alice@example.com",
				rating: 5,
				body: "Great.",
				customerId: "cust_1",
			});
			await controller.createReview({
				productId: "prod_2",
				authorName: "Alice",
				authorEmail: "alice@example.com",
				rating: 4,
				body: "Good.",
				customerId: "cust_1",
			});
			await controller.createReview({
				productId: "prod_1",
				authorName: "Bob",
				authorEmail: "bob@example.com",
				rating: 3,
				body: "OK.",
				customerId: "cust_2",
			});

			const result = await controller.listReviewsByCustomer("cust_1");
			expect(result.reviews).toHaveLength(2);
			expect(result.total).toBe(2);
		});

		it("filters by status for a customer", async () => {
			const r1 = await controller.createReview({
				productId: "prod_1",
				authorName: "Alice",
				authorEmail: "alice@example.com",
				rating: 5,
				body: "Great.",
				customerId: "cust_1",
			});
			await controller.createReview({
				productId: "prod_2",
				authorName: "Alice",
				authorEmail: "alice@example.com",
				rating: 4,
				body: "Good.",
				customerId: "cust_1",
			});

			await controller.updateReviewStatus(r1.id, "approved");

			const result = await controller.listReviewsByCustomer("cust_1", {
				status: "approved",
			});
			expect(result.reviews).toHaveLength(1);
			expect(result.reviews[0].status).toBe("approved");
			expect(result.total).toBe(1);
		});

		it("paginates correctly with take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createReview({
					productId: `prod_${i}`,
					authorName: "Alice",
					authorEmail: "alice@example.com",
					rating: 4,
					body: `Review ${i}`,
					customerId: "cust_1",
				});
			}

			const page1 = await controller.listReviewsByCustomer("cust_1", {
				take: 2,
				skip: 0,
			});
			expect(page1.reviews).toHaveLength(2);
			expect(page1.total).toBe(5);

			const page2 = await controller.listReviewsByCustomer("cust_1", {
				take: 2,
				skip: 2,
			});
			expect(page2.reviews).toHaveLength(2);
			expect(page2.total).toBe(5);

			const page3 = await controller.listReviewsByCustomer("cust_1", {
				take: 2,
				skip: 4,
			});
			expect(page3.reviews).toHaveLength(1);
			expect(page3.total).toBe(5);
		});

		it("returns empty for customer with no reviews", async () => {
			const result = await controller.listReviewsByCustomer("cust_none");
			expect(result.reviews).toHaveLength(0);
			expect(result.total).toBe(0);
		});
	});

	// ── createReviewRequest edge cases ──────────────────────────────────

	describe("createReviewRequest edge cases", () => {
		it("creates a review request with all fields", async () => {
			const request = await controller.createReviewRequest({
				orderId: "order_1",
				orderNumber: "ORD-001",
				email: "customer@example.com",
				customerName: "Alice",
				items: [
					{ productId: "prod_1", name: "Widget A" },
					{ productId: "prod_2", name: "Widget B" },
				],
			});
			expect(request.id).toBeDefined();
			expect(request.orderId).toBe("order_1");
			expect(request.orderNumber).toBe("ORD-001");
			expect(request.email).toBe("customer@example.com");
			expect(request.customerName).toBe("Alice");
			expect(request.items).toHaveLength(2);
			expect(request.sentAt).toBeInstanceOf(Date);
		});
	});

	// ── getReviewRequest edge cases ─────────────────────────────────────

	describe("getReviewRequest edge cases", () => {
		it("finds review request by orderId", async () => {
			await controller.createReviewRequest({
				orderId: "order_1",
				orderNumber: "ORD-001",
				email: "customer@example.com",
				customerName: "Alice",
				items: [{ productId: "prod_1", name: "Widget" }],
			});
			const found = await controller.getReviewRequest("order_1");
			expect(found).not.toBeNull();
			expect(found?.orderId).toBe("order_1");
		});

		it("returns null for non-existent orderId", async () => {
			const found = await controller.getReviewRequest("non-existent");
			expect(found).toBeNull();
		});
	});

	// ── listReviewRequests edge cases ───────────────────────────────────

	describe("listReviewRequests edge cases", () => {
		it("returns all requests without params", async () => {
			await controller.createReviewRequest({
				orderId: "order_1",
				orderNumber: "ORD-001",
				email: "a@example.com",
				customerName: "A",
				items: [{ productId: "prod_1", name: "Widget" }],
			});
			await controller.createReviewRequest({
				orderId: "order_2",
				orderNumber: "ORD-002",
				email: "b@example.com",
				customerName: "B",
				items: [{ productId: "prod_2", name: "Gadget" }],
			});
			const all = await controller.listReviewRequests();
			expect(all).toHaveLength(2);
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createReviewRequest({
					orderId: `order_${i}`,
					orderNumber: `ORD-00${i}`,
					email: `user${i}@example.com`,
					customerName: `User ${i}`,
					items: [{ productId: `prod_${i}`, name: `Product ${i}` }],
				});
			}
			const page = await controller.listReviewRequests({
				take: 2,
				skip: 0,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── getReviewRequestStats edge cases ────────────────────────────────

	describe("getReviewRequestStats edge cases", () => {
		it("returns zeroes for empty store", async () => {
			const stats = await controller.getReviewRequestStats();
			expect(stats.totalSent).toBe(0);
			expect(stats.uniqueOrders).toBe(0);
		});

		it("counts unique orders correctly with duplicate orderId requests", async () => {
			await controller.createReviewRequest({
				orderId: "order_1",
				orderNumber: "ORD-001",
				email: "a@example.com",
				customerName: "A",
				items: [{ productId: "prod_1", name: "Widget" }],
			});
			await controller.createReviewRequest({
				orderId: "order_1",
				orderNumber: "ORD-001",
				email: "a@example.com",
				customerName: "A",
				items: [{ productId: "prod_2", name: "Gadget" }],
			});
			await controller.createReviewRequest({
				orderId: "order_2",
				orderNumber: "ORD-002",
				email: "b@example.com",
				customerName: "B",
				items: [{ productId: "prod_3", name: "Doohickey" }],
			});

			const stats = await controller.getReviewRequestStats();
			expect(stats.totalSent).toBe(3);
			expect(stats.uniqueOrders).toBe(2);
		});
	});

	// ── full lifecycle scenarios ────────────────────────────────────────

	describe("full lifecycle scenarios", () => {
		it("create, approve, add response, mark helpful, verify analytics", async () => {
			const review = await controller.createReview({
				productId: "prod_1",
				authorName: "Alice",
				authorEmail: "alice@example.com",
				rating: 5,
				body: "Absolutely love this product!",
				customerId: "cust_1",
				isVerifiedPurchase: true,
			});

			// Approve
			await controller.updateReviewStatus(review.id, "approved");

			// Add merchant response
			await controller.addMerchantResponse(
				review.id,
				"Thank you for your kind words!",
			);

			// Mark helpful multiple times
			await controller.markHelpful(review.id);
			await controller.markHelpful(review.id);

			// Verify final state
			const final = await controller.getReview(review.id);
			expect(final?.status).toBe("approved");
			expect(final?.merchantResponse).toBe("Thank you for your kind words!");
			expect(final?.helpfulCount).toBe(2);
			expect(final?.isVerifiedPurchase).toBe(true);

			// Verify analytics
			const analytics = await controller.getReviewAnalytics();
			expect(analytics.totalReviews).toBe(1);
			expect(analytics.approvedCount).toBe(1);
			expect(analytics.withMerchantResponse).toBe(1);
			expect(analytics.averageRating).toBe(5);

			// Verify product summary
			const summary = await controller.getProductRatingSummary("prod_1");
			expect(summary.count).toBe(1);
			expect(summary.average).toBe(5);
		});

		it("analytics reflect deletions", async () => {
			const r1 = await controller.createReview({
				productId: "prod_1",
				authorName: "A",
				authorEmail: "a@example.com",
				rating: 5,
				body: "Great.",
			});
			await controller.createReview({
				productId: "prod_1",
				authorName: "B",
				authorEmail: "b@example.com",
				rating: 3,
				body: "OK.",
			});

			let analytics = await controller.getReviewAnalytics();
			expect(analytics.totalReviews).toBe(2);

			await controller.deleteReview(r1.id);

			analytics = await controller.getReviewAnalytics();
			expect(analytics.totalReviews).toBe(1);
			expect(analytics.averageRating).toBe(3);
		});
	});

	// ── data store consistency ──────────────────────────────────────────

	describe("data store consistency", () => {
		it("review store size matches expected items", async () => {
			await controller.createReview({
				productId: "prod_1",
				authorName: "A",
				authorEmail: "a@example.com",
				rating: 5,
				body: "Great.",
			});
			await controller.createReview({
				productId: "prod_2",
				authorName: "B",
				authorEmail: "b@example.com",
				rating: 3,
				body: "OK.",
			});
			expect(mockData.size("review")).toBe(2);
		});

		it("review request store size matches expected items", async () => {
			await controller.createReviewRequest({
				orderId: "order_1",
				orderNumber: "ORD-001",
				email: "a@example.com",
				customerName: "A",
				items: [{ productId: "prod_1", name: "Widget" }],
			});
			expect(mockData.size("reviewRequest")).toBe(1);
		});

		it("store is empty after deleting all reviews", async () => {
			const r1 = await controller.createReview({
				productId: "prod_1",
				authorName: "A",
				authorEmail: "a@example.com",
				rating: 5,
				body: "Great.",
			});
			const r2 = await controller.createReview({
				productId: "prod_2",
				authorName: "B",
				authorEmail: "b@example.com",
				rating: 3,
				body: "OK.",
			});
			await controller.deleteReview(r1.id);
			await controller.deleteReview(r2.id);
			expect(mockData.size("review")).toBe(0);
		});
	});
});
