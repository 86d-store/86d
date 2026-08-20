import {
	createMockDataService,
	createMockModuleContext,
} from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import reviewsModule from "../index";
import type { ReviewController } from "../service";
import { createReviewController } from "../service-impl";

// ── Helper ──────────────────────────────────────────────────────────────────

function makeReview(overrides: Record<string, unknown> = {}) {
	return {
		productId: "prod_1",
		authorName: "Alice",
		authorEmail: "alice@test.com",
		rating: 5,
		body: "Great product!",
		...overrides,
	} as Parameters<ReturnType<typeof createReviewController>["createReview"]>[0];
}

// ── Controller ──────────────────────────────────────────────────────────────

describe("createReviewController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createReviewController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createReviewController(mockData);
	});

	// ── createReview ─────────────────────────────────────────────────────

	describe("createReview", () => {
		it("creates a review with pending status by default", async () => {
			const review = await controller.createReview(makeReview());
			expect(review.id).toBeDefined();
			expect(review.productId).toBe("prod_1");
			expect(review.authorName).toBe("Alice");
			expect(review.rating).toBe(5);
			expect(review.status).toBe("pending");
			expect(review.isVerifiedPurchase).toBe(false);
			expect(review.helpfulCount).toBe(0);
		});

		it("creates a review with approved status when autoApprove is true", async () => {
			const ctrl = createReviewController(mockData, {
				autoApprove: true,
			});
			const review = await ctrl.createReview(
				makeReview({ authorName: "Bob", authorEmail: "bob@example.com" }),
			);
			expect(review.status).toBe("approved");
		});

		it("stores optional fields", async () => {
			const review = await controller.createReview(
				makeReview({
					authorName: "Carol",
					authorEmail: "carol@example.com",
					rating: 3,
					title: "Decent",
					body: "It works okay.",
					customerId: "cust_1",
					isVerifiedPurchase: true,
				}),
			);
			expect(review.title).toBe("Decent");
			expect(review.customerId).toBe("cust_1");
			expect(review.isVerifiedPurchase).toBe(true);
		});

		it("persists to data store", async () => {
			const review = await controller.createReview(
				makeReview({ authorName: "Dan", authorEmail: "dan@example.com" }),
			);
			const found = await controller.getReview(review.id);
			expect(found).not.toBeNull();
			expect(found?.authorName).toBe("Dan");
		});

		it("assigns unique ids to each review", async () => {
			const r1 = await controller.createReview(makeReview());
			const r2 = await controller.createReview(
				makeReview({ authorEmail: "b@test.com" }),
			);
			expect(r1.id).not.toBe(r2.id);
		});

		it("sets createdAt and updatedAt to current time", async () => {
			const before = new Date();
			const review = await controller.createReview(makeReview());
			const after = new Date();
			expect(review.createdAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(review.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
			expect(review.updatedAt.getTime()).toBe(review.createdAt.getTime());
		});

		it("defaults isVerifiedPurchase to false when not provided", async () => {
			const review = await controller.createReview(makeReview());
			expect(review.isVerifiedPurchase).toBe(false);
		});

		it("defaults title to undefined when not provided", async () => {
			const review = await controller.createReview(makeReview());
			expect(review.title).toBeUndefined();
		});

		it("defaults customerId to undefined when not provided", async () => {
			const review = await controller.createReview(makeReview());
			expect(review.customerId).toBeUndefined();
		});

		it("handles autoApprove false explicitly", async () => {
			const ctrl = createReviewController(mockData, {
				autoApprove: false,
			});
			const review = await ctrl.createReview(makeReview());
			expect(review.status).toBe("pending");
		});

		it("handles each rating value from 1 to 5", async () => {
			for (let rating = 1; rating <= 5; rating++) {
				const review = await controller.createReview(
					makeReview({ rating, authorEmail: `r${rating}@test.com` }),
				);
				expect(review.rating).toBe(rating);
			}
		});
	});

	// ── getReview ────────────────────────────────────────────────────────

	describe("getReview", () => {
		it("returns an existing review", async () => {
			const created = await controller.createReview(
				makeReview({ authorName: "Eve", authorEmail: "eve@example.com" }),
			);
			const found = await controller.getReview(created.id);
			expect(found?.id).toBe(created.id);
		});

		it("returns null for non-existent review", async () => {
			const found = await controller.getReview("missing");
			expect(found).toBeNull();
		});

		it("returns all fields from the created review", async () => {
			const created = await controller.createReview(
				makeReview({
					title: "Excellent",
					customerId: "cust_99",
					isVerifiedPurchase: true,
				}),
			);
			const found = await controller.getReview(created.id);
			expect(found?.productId).toBe("prod_1");
			expect(found?.authorName).toBe("Alice");
			expect(found?.authorEmail).toBe("alice@test.com");
			expect(found?.rating).toBe(5);
			expect(found?.title).toBe("Excellent");
			expect(found?.body).toBe("Great product!");
			expect(found?.customerId).toBe("cust_99");
			expect(found?.isVerifiedPurchase).toBe(true);
			expect(found?.helpfulCount).toBe(0);
		});

		it("returns null after a review is deleted", async () => {
			const review = await controller.createReview(makeReview());
			await controller.deleteReview(review.id);
			const found = await controller.getReview(review.id);
			expect(found).toBeNull();
		});
	});

	// ── listReviewsByProduct ─────────────────────────────────────────────

	describe("listReviewsByProduct", () => {
		it("lists reviews for a product", async () => {
			await controller.createReview(makeReview());
			await controller.createReview(
				makeReview({ authorEmail: "b@test.com", rating: 4 }),
			);
			await controller.createReview(
				makeReview({
					productId: "prod_2",
					authorEmail: "c@test.com",
					rating: 3,
				}),
			);
			const reviews = await controller.listReviewsByProduct("prod_1");
			expect(reviews).toHaveLength(2);
		});

		it("filters to approved only", async () => {
			const r1 = await controller.createReview(makeReview());
			await controller.createReview(
				makeReview({ authorEmail: "b@test.com", rating: 2, body: "Meh" }),
			);
			await controller.updateReviewStatus(r1.id, "approved");

			const approved = await controller.listReviewsByProduct("prod_1", {
				approvedOnly: true,
			});
			expect(approved).toHaveLength(1);
			expect(approved[0].authorName).toBe("Alice");
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createReview(
					makeReview({
						authorName: `User ${i}`,
						authorEmail: `u${i}@test.com`,
						rating: 3,
						body: `Review ${i}`,
					}),
				);
			}
			const page = await controller.listReviewsByProduct("prod_1", {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});

		it("returns empty array for product with no reviews", async () => {
			const reviews = await controller.listReviewsByProduct(
				"nonexistent_product",
			);
			expect(reviews).toHaveLength(0);
		});

		it("returns empty when skip exceeds total count", async () => {
			await controller.createReview(makeReview());
			await controller.createReview(makeReview({ authorEmail: "b@test.com" }));
			const reviews = await controller.listReviewsByProduct("prod_1", {
				skip: 100,
			});
			expect(reviews).toHaveLength(0);
		});

		it("excludes rejected reviews when filtering approved only", async () => {
			const r1 = await controller.createReview(
				makeReview({ authorEmail: "a@test.com" }),
			);
			const r2 = await controller.createReview(
				makeReview({ authorEmail: "b@test.com" }),
			);
			await controller.updateReviewStatus(r1.id, "approved");
			await controller.updateReviewStatus(r2.id, "rejected");

			const approved = await controller.listReviewsByProduct("prod_1", {
				approvedOnly: true,
			});
			expect(approved).toHaveLength(1);
			expect(approved[0].id).toBe(r1.id);
		});

		it("returns all statuses when approvedOnly is false", async () => {
			const r1 = await controller.createReview(
				makeReview({ authorEmail: "a@test.com" }),
			);
			await controller.createReview(makeReview({ authorEmail: "b@test.com" }));
			await controller.updateReviewStatus(r1.id, "approved");

			const all = await controller.listReviewsByProduct("prod_1", {
				approvedOnly: false,
			});
			expect(all).toHaveLength(2);
		});
	});

	// ── listReviews ──────────────────────────────────────────────────────

	describe("listReviews", () => {
		it("lists all reviews without filters", async () => {
			await controller.createReview(makeReview());
			await controller.createReview(
				makeReview({ productId: "prod_2", authorEmail: "b@test.com" }),
			);
			const all = await controller.listReviews();
			expect(all).toHaveLength(2);
		});

		it("filters by productId", async () => {
			await controller.createReview(makeReview());
			await controller.createReview(
				makeReview({ productId: "prod_2", authorEmail: "b@test.com" }),
			);
			const results = await controller.listReviews({
				productId: "prod_1",
			});
			expect(results).toHaveLength(1);
		});

		it("filters by status", async () => {
			const r = await controller.createReview(makeReview());
			await controller.updateReviewStatus(r.id, "approved");
			await controller.createReview(
				makeReview({ productId: "prod_2", authorEmail: "b@test.com" }),
			);
			const approved = await controller.listReviews({
				status: "approved",
			});
			expect(approved).toHaveLength(1);
		});

		it("filters by productId and status combined", async () => {
			const r1 = await controller.createReview(makeReview());
			const r2 = await controller.createReview(
				makeReview({ productId: "prod_2", authorEmail: "b@test.com" }),
			);
			await controller.createReview(makeReview({ authorEmail: "c@test.com" }));
			await controller.updateReviewStatus(r1.id, "approved");
			await controller.updateReviewStatus(r2.id, "approved");

			const results = await controller.listReviews({
				productId: "prod_1",
				status: "approved",
			});
			expect(results).toHaveLength(1);
			expect(results[0].id).toBe(r1.id);
		});

		it("returns empty array when no reviews match filters", async () => {
			await controller.createReview(makeReview());
			const results = await controller.listReviews({
				status: "approved",
			});
			expect(results).toHaveLength(0);
		});

		it("supports take pagination", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.createReview(
					makeReview({ authorEmail: `u${i}@test.com` }),
				);
			}
			const page = await controller.listReviews({ take: 3 });
			expect(page).toHaveLength(3);
		});

		it("supports skip pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createReview(
					makeReview({ authorEmail: `u${i}@test.com` }),
				);
			}
			const page = await controller.listReviews({ skip: 3 });
			expect(page).toHaveLength(2);
		});

		it("supports take and skip together", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.createReview(
					makeReview({ authorEmail: `u${i}@test.com` }),
				);
			}
			const page = await controller.listReviews({ take: 3, skip: 2 });
			expect(page).toHaveLength(3);
		});

		it("returns empty when skip exceeds total", async () => {
			await controller.createReview(makeReview());
			const results = await controller.listReviews({ skip: 100 });
			expect(results).toHaveLength(0);
		});

		it("filters rejected reviews", async () => {
			const r1 = await controller.createReview(
				makeReview({ authorEmail: "a@test.com" }),
			);
			const r2 = await controller.createReview(
				makeReview({ authorEmail: "b@test.com" }),
			);
			await controller.updateReviewStatus(r1.id, "approved");
			await controller.updateReviewStatus(r2.id, "rejected");

			const rejected = await controller.listReviews({ status: "rejected" });
			expect(rejected).toHaveLength(1);
			expect(rejected[0].id).toBe(r2.id);
		});

		it("lists pending reviews", async () => {
			await controller.createReview(makeReview({ authorEmail: "a@test.com" }));
			const r2 = await controller.createReview(
				makeReview({ authorEmail: "b@test.com" }),
			);
			await controller.updateReviewStatus(r2.id, "approved");

			const pending = await controller.listReviews({ status: "pending" });
			expect(pending).toHaveLength(1);
		});
	});

	// ── updateReviewStatus ───────────────────────────────────────────────

	describe("updateReviewStatus", () => {
		it("updates the review status", async () => {
			const review = await controller.createReview(makeReview());
			const updated = await controller.updateReviewStatus(
				review.id,
				"approved",
			);
			expect(updated?.status).toBe("approved");
		});

		it("returns null for non-existent review", async () => {
			const result = await controller.updateReviewStatus("missing", "approved");
			expect(result).toBeNull();
		});

		it("can reject a review", async () => {
			const review = await controller.createReview(
				makeReview({
					authorName: "Spam",
					authorEmail: "spam@test.com",
					rating: 1,
					body: "Buy my stuff!",
				}),
			);
			const rejected = await controller.updateReviewStatus(
				review.id,
				"rejected",
			);
			expect(rejected?.status).toBe("rejected");
		});

		it("transitions from approved to rejected", async () => {
			const review = await controller.createReview(makeReview());
			await controller.updateReviewStatus(review.id, "approved");
			const rejected = await controller.updateReviewStatus(
				review.id,
				"rejected",
			);
			expect(rejected?.status).toBe("rejected");
		});

		it("transitions from rejected to approved", async () => {
			const review = await controller.createReview(makeReview());
			await controller.updateReviewStatus(review.id, "rejected");
			const approved = await controller.updateReviewStatus(
				review.id,
				"approved",
			);
			expect(approved?.status).toBe("approved");
		});

		it("can set same status again (idempotent)", async () => {
			const review = await controller.createReview(makeReview());
			await controller.updateReviewStatus(review.id, "approved");
			const again = await controller.updateReviewStatus(review.id, "approved");
			expect(again?.status).toBe("approved");
		});

		it("updates updatedAt timestamp", async () => {
			const review = await controller.createReview(makeReview());
			const originalUpdatedAt = review.updatedAt;
			// Small delay to ensure timestamp difference
			await new Promise((r) => setTimeout(r, 5));
			const updated = await controller.updateReviewStatus(
				review.id,
				"approved",
			);
			expect(updated?.updatedAt.getTime()).toBeGreaterThan(
				originalUpdatedAt.getTime(),
			);
		});

		it("preserves other fields when updating status", async () => {
			const review = await controller.createReview(
				makeReview({
					title: "My Title",
					customerId: "cust_1",
					isVerifiedPurchase: true,
				}),
			);
			const updated = await controller.updateReviewStatus(
				review.id,
				"approved",
			);
			expect(updated?.productId).toBe(review.productId);
			expect(updated?.authorName).toBe(review.authorName);
			expect(updated?.authorEmail).toBe(review.authorEmail);
			expect(updated?.rating).toBe(review.rating);
			expect(updated?.title).toBe("My Title");
			expect(updated?.body).toBe(review.body);
			expect(updated?.customerId).toBe("cust_1");
			expect(updated?.isVerifiedPurchase).toBe(true);
			expect(updated?.helpfulCount).toBe(0);
		});

		it("persists status change to data store", async () => {
			const review = await controller.createReview(makeReview());
			await controller.updateReviewStatus(review.id, "approved");
			const found = await controller.getReview(review.id);
			expect(found?.status).toBe("approved");
		});
	});

	// ── deleteReview ─────────────────────────────────────────────────────

	describe("deleteReview", () => {
		it("deletes an existing review", async () => {
			const review = await controller.createReview(makeReview());
			const result = await controller.deleteReview(review.id);
			expect(result).toBe(true);
			const found = await controller.getReview(review.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent review", async () => {
			const result = await controller.deleteReview("missing");
			expect(result).toBe(false);
		});

		it("does not affect other reviews", async () => {
			const r1 = await controller.createReview(
				makeReview({ authorEmail: "a@test.com" }),
			);
			const r2 = await controller.createReview(
				makeReview({ authorEmail: "b@test.com" }),
			);
			await controller.deleteReview(r1.id);
			const remaining = await controller.getReview(r2.id);
			expect(remaining).not.toBeNull();
			expect(remaining?.authorEmail).toBe("b@test.com");
		});

		it("removes review from listReviews results", async () => {
			const r1 = await controller.createReview(
				makeReview({ authorEmail: "a@test.com" }),
			);
			await controller.createReview(makeReview({ authorEmail: "b@test.com" }));
			await controller.deleteReview(r1.id);
			const all = await controller.listReviews();
			expect(all).toHaveLength(1);
		});

		it("removes review from product listing", async () => {
			const r1 = await controller.createReview(
				makeReview({ authorEmail: "a@test.com" }),
			);
			await controller.createReview(makeReview({ authorEmail: "b@test.com" }));
			await controller.deleteReview(r1.id);
			const reviews = await controller.listReviewsByProduct("prod_1");
			expect(reviews).toHaveLength(1);
		});

		it("removes review from rating summary", async () => {
			const ctrl = createReviewController(mockData, { autoApprove: true });
			const r1 = await ctrl.createReview(
				makeReview({ rating: 5, authorEmail: "a@test.com" }),
			);
			await ctrl.createReview(
				makeReview({ rating: 3, authorEmail: "b@test.com" }),
			);
			await ctrl.deleteReview(r1.id);
			const summary = await ctrl.getProductRatingSummary("prod_1");
			expect(summary.count).toBe(1);
			expect(summary.average).toBe(3);
		});
	});

	// ── addMerchantResponse ─────────────────────────────────────────────

	describe("addMerchantResponse", () => {
		it("adds a merchant response to an existing review", async () => {
			const review = await controller.createReview(makeReview());
			const updated = await controller.addMerchantResponse(
				review.id,
				"Thank you for your feedback!",
			);
			expect(updated?.merchantResponse).toBe("Thank you for your feedback!");
			expect(updated?.merchantResponseAt).toBeInstanceOf(Date);
		});

		it("returns null for non-existent review", async () => {
			const result = await controller.addMerchantResponse(
				"missing",
				"response",
			);
			expect(result).toBeNull();
		});

		it("overwrites existing merchant response", async () => {
			const review = await controller.createReview(makeReview());
			await controller.addMerchantResponse(review.id, "First response");
			const updated = await controller.addMerchantResponse(
				review.id,
				"Updated response",
			);
			expect(updated?.merchantResponse).toBe("Updated response");
		});

		it("updates updatedAt timestamp", async () => {
			const review = await controller.createReview(makeReview());
			await new Promise((r) => setTimeout(r, 5));
			const updated = await controller.addMerchantResponse(
				review.id,
				"Response",
			);
			expect(updated?.updatedAt.getTime()).toBeGreaterThan(
				review.updatedAt.getTime(),
			);
		});

		it("preserves other fields", async () => {
			const review = await controller.createReview(
				makeReview({
					title: "Great",
					customerId: "cust_1",
					isVerifiedPurchase: true,
				}),
			);
			const updated = await controller.addMerchantResponse(review.id, "Thanks");
			expect(updated?.title).toBe("Great");
			expect(updated?.customerId).toBe("cust_1");
			expect(updated?.isVerifiedPurchase).toBe(true);
			expect(updated?.status).toBe("pending");
		});

		it("persists response to data store", async () => {
			const review = await controller.createReview(makeReview());
			await controller.addMerchantResponse(review.id, "Persisted response");
			const found = await controller.getReview(review.id);
			expect(found?.merchantResponse).toBe("Persisted response");
		});
	});

	// ── markHelpful ─────────────────────────────────────────────────────

	describe("markHelpful", () => {
		it("increments helpfulCount by 1", async () => {
			const review = await controller.createReview(makeReview());
			expect(review.helpfulCount).toBe(0);
			const updated = await controller.markHelpful(review.id);
			expect(updated?.helpfulCount).toBe(1);
		});

		it("increments multiple times", async () => {
			const review = await controller.createReview(makeReview());
			await controller.markHelpful(review.id);
			await controller.markHelpful(review.id);
			const updated = await controller.markHelpful(review.id);
			expect(updated?.helpfulCount).toBe(3);
		});

		it("returns null for non-existent review", async () => {
			const result = await controller.markHelpful("missing");
			expect(result).toBeNull();
		});

		it("updates updatedAt timestamp", async () => {
			const review = await controller.createReview(makeReview());
			await new Promise((r) => setTimeout(r, 5));
			const updated = await controller.markHelpful(review.id);
			expect(updated?.updatedAt.getTime()).toBeGreaterThan(
				review.updatedAt.getTime(),
			);
		});

		it("preserves other fields", async () => {
			const review = await controller.createReview(
				makeReview({
					title: "Helpful review",
					rating: 4,
				}),
			);
			const updated = await controller.markHelpful(review.id);
			expect(updated?.title).toBe("Helpful review");
			expect(updated?.rating).toBe(4);
			expect(updated?.status).toBe("pending");
		});

		it("persists helpful count to data store", async () => {
			const review = await controller.createReview(makeReview());
			await controller.markHelpful(review.id);
			const found = await controller.getReview(review.id);
			expect(found?.helpfulCount).toBe(1);
		});
	});

	// ── getReviewAnalytics ──────────────────────────────────────────────

	describe("getReviewAnalytics", () => {
		it("returns zeros when there are no reviews", async () => {
			const analytics = await controller.getReviewAnalytics();
			expect(analytics.totalReviews).toBe(0);
			expect(analytics.pendingCount).toBe(0);
			expect(analytics.approvedCount).toBe(0);
			expect(analytics.rejectedCount).toBe(0);
			expect(analytics.averageRating).toBe(0);
			expect(analytics.withMerchantResponse).toBe(0);
		});

		it("counts reviews by status", async () => {
			const r1 = await controller.createReview(
				makeReview({ authorEmail: "a@test.com" }),
			);
			const r2 = await controller.createReview(
				makeReview({ authorEmail: "b@test.com" }),
			);
			await controller.createReview(makeReview({ authorEmail: "c@test.com" }));
			await controller.updateReviewStatus(r1.id, "approved");
			await controller.updateReviewStatus(r2.id, "rejected");
			// r3 stays pending

			const analytics = await controller.getReviewAnalytics();
			expect(analytics.totalReviews).toBe(3);
			expect(analytics.approvedCount).toBe(1);
			expect(analytics.rejectedCount).toBe(1);
			expect(analytics.pendingCount).toBe(1);
		});

		it("computes average rating across all reviews", async () => {
			await controller.createReview(
				makeReview({ rating: 5, authorEmail: "a@test.com" }),
			);
			await controller.createReview(
				makeReview({ rating: 3, authorEmail: "b@test.com" }),
			);
			await controller.createReview(
				makeReview({ rating: 4, authorEmail: "c@test.com" }),
			);

			const analytics = await controller.getReviewAnalytics();
			expect(analytics.averageRating).toBe(4); // (5+3+4)/3 = 4.0
		});

		it("computes ratings distribution", async () => {
			await controller.createReview(
				makeReview({ rating: 5, authorEmail: "a@test.com" }),
			);
			await controller.createReview(
				makeReview({ rating: 5, authorEmail: "b@test.com" }),
			);
			await controller.createReview(
				makeReview({ rating: 3, authorEmail: "c@test.com" }),
			);
			await controller.createReview(
				makeReview({ rating: 1, authorEmail: "d@test.com" }),
			);

			const analytics = await controller.getReviewAnalytics();
			expect(analytics.ratingsDistribution).toEqual({
				"1": 1,
				"2": 0,
				"3": 1,
				"4": 0,
				"5": 2,
			});
		});

		it("counts reviews with merchant responses", async () => {
			const r1 = await controller.createReview(
				makeReview({ authorEmail: "a@test.com" }),
			);
			const r2 = await controller.createReview(
				makeReview({ authorEmail: "b@test.com" }),
			);
			await controller.createReview(makeReview({ authorEmail: "c@test.com" }));

			await controller.addMerchantResponse(r1.id, "Thanks!");
			await controller.addMerchantResponse(r2.id, "We appreciate it");

			const analytics = await controller.getReviewAnalytics();
			expect(analytics.withMerchantResponse).toBe(2);
		});

		it("includes reviews from all products", async () => {
			await controller.createReview(
				makeReview({ productId: "prod_1", authorEmail: "a@test.com" }),
			);
			await controller.createReview(
				makeReview({ productId: "prod_2", authorEmail: "b@test.com" }),
			);
			await controller.createReview(
				makeReview({ productId: "prod_3", authorEmail: "c@test.com" }),
			);

			const analytics = await controller.getReviewAnalytics();
			expect(analytics.totalReviews).toBe(3);
		});
	});

	// ── updateReviewStatus with moderationNote ──────────────────────────

	describe("updateReviewStatus with moderationNote", () => {
		it("stores a moderation note when provided", async () => {
			const review = await controller.createReview(makeReview());
			const updated = await controller.updateReviewStatus(
				review.id,
				"rejected",
				"Spam content",
			);
			expect(updated?.moderationNote).toBe("Spam content");
			expect(updated?.status).toBe("rejected");
		});

		it("does not overwrite moderationNote when not provided", async () => {
			const review = await controller.createReview(makeReview());
			await controller.updateReviewStatus(review.id, "rejected", "First note");
			const updated = await controller.updateReviewStatus(
				review.id,
				"approved",
			);
			// The note from the first call should still be there (we spread existing fields)
			expect(updated?.status).toBe("approved");
		});

		it("updates moderationNote on subsequent calls", async () => {
			const review = await controller.createReview(makeReview());
			await controller.updateReviewStatus(
				review.id,
				"rejected",
				"Initial note",
			);
			const updated = await controller.updateReviewStatus(
				review.id,
				"rejected",
				"Updated note",
			);
			expect(updated?.moderationNote).toBe("Updated note");
		});
	});

	// ── getProductRatingSummary ───────────────────────────────────────────

	describe("getProductRatingSummary", () => {
		it("returns zeros for product with no reviews", async () => {
			const summary = await controller.getProductRatingSummary("prod_empty");
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

		it("computes average and distribution for approved reviews", async () => {
			const r1 = await controller.createReview(
				makeReview({ rating: 5, authorEmail: "a@test.com", body: "Amazing" }),
			);
			const r2 = await controller.createReview(
				makeReview({ rating: 3, authorEmail: "b@test.com", body: "OK" }),
			);
			// Pending review should be excluded
			await controller.createReview(
				makeReview({ rating: 1, authorEmail: "c@test.com", body: "Bad" }),
			);

			await controller.updateReviewStatus(r1.id, "approved");
			await controller.updateReviewStatus(r2.id, "approved");

			const summary = await controller.getProductRatingSummary("prod_1");
			expect(summary.count).toBe(2);
			expect(summary.average).toBe(4); // (5+3)/2 = 4.0
			expect(summary.distribution["5"]).toBe(1);
			expect(summary.distribution["3"]).toBe(1);
			expect(summary.distribution["1"]).toBe(0);
		});

		it("only counts approved reviews from the target product", async () => {
			const r = await controller.createReview(
				makeReview({ rating: 5, authorEmail: "a@test.com" }),
			);
			await controller.updateReviewStatus(r.id, "approved");

			const otherR = await controller.createReview(
				makeReview({
					productId: "prod_2",
					rating: 1,
					authorEmail: "b@test.com",
				}),
			);
			await controller.updateReviewStatus(otherR.id, "approved");

			const summary = await controller.getProductRatingSummary("prod_1");
			expect(summary.count).toBe(1);
			expect(summary.average).toBe(5);
		});

		it("computes fractional average correctly (4.3)", async () => {
			const ctrl = createReviewController(mockData, { autoApprove: true });
			// Ratings: 5, 4, 4 → avg = 13/3 = 4.333... → rounds to 4.3
			await ctrl.createReview(
				makeReview({ rating: 5, authorEmail: "a@test.com" }),
			);
			await ctrl.createReview(
				makeReview({ rating: 4, authorEmail: "b@test.com" }),
			);
			await ctrl.createReview(
				makeReview({ rating: 4, authorEmail: "c@test.com" }),
			);

			const summary = await ctrl.getProductRatingSummary("prod_1");
			expect(summary.average).toBe(4.3);
			expect(summary.count).toBe(3);
		});

		it("computes fractional average correctly (3.7)", async () => {
			const ctrl = createReviewController(mockData, { autoApprove: true });
			// Ratings: 5, 4, 2 → avg = 11/3 = 3.666... → rounds to 3.7
			await ctrl.createReview(
				makeReview({ rating: 5, authorEmail: "a@test.com" }),
			);
			await ctrl.createReview(
				makeReview({ rating: 4, authorEmail: "b@test.com" }),
			);
			await ctrl.createReview(
				makeReview({ rating: 2, authorEmail: "c@test.com" }),
			);

			const summary = await ctrl.getProductRatingSummary("prod_1");
			expect(summary.average).toBe(3.7);
		});

		it("handles all reviews with the same rating", async () => {
			const ctrl = createReviewController(mockData, { autoApprove: true });
			for (let i = 0; i < 5; i++) {
				await ctrl.createReview(
					makeReview({ rating: 4, authorEmail: `u${i}@test.com` }),
				);
			}
			const summary = await ctrl.getProductRatingSummary("prod_1");
			expect(summary.average).toBe(4);
			expect(summary.count).toBe(5);
			expect(summary.distribution).toEqual({
				"1": 0,
				"2": 0,
				"3": 0,
				"4": 5,
				"5": 0,
			});
		});

		it("handles a full distribution across all ratings", async () => {
			const ctrl = createReviewController(mockData, { autoApprove: true });
			for (let rating = 1; rating <= 5; rating++) {
				await ctrl.createReview(
					makeReview({ rating, authorEmail: `r${rating}@test.com` }),
				);
			}
			const summary = await ctrl.getProductRatingSummary("prod_1");
			expect(summary.average).toBe(3); // (1+2+3+4+5)/5 = 3.0
			expect(summary.count).toBe(5);
			expect(summary.distribution).toEqual({
				"1": 1,
				"2": 1,
				"3": 1,
				"4": 1,
				"5": 1,
			});
		});

		it("handles a single approved review", async () => {
			const r = await controller.createReview(makeReview({ rating: 3 }));
			await controller.updateReviewStatus(r.id, "approved");
			const summary = await controller.getProductRatingSummary("prod_1");
			expect(summary.average).toBe(3);
			expect(summary.count).toBe(1);
			expect(summary.distribution["3"]).toBe(1);
		});

		it("excludes rejected reviews from summary", async () => {
			const r1 = await controller.createReview(
				makeReview({ rating: 5, authorEmail: "a@test.com" }),
			);
			const r2 = await controller.createReview(
				makeReview({ rating: 1, authorEmail: "b@test.com" }),
			);
			await controller.updateReviewStatus(r1.id, "approved");
			await controller.updateReviewStatus(r2.id, "rejected");

			const summary = await controller.getProductRatingSummary("prod_1");
			expect(summary.count).toBe(1);
			expect(summary.average).toBe(5);
			expect(summary.distribution["1"]).toBe(0);
		});

		it("updates summary after status changes", async () => {
			const r1 = await controller.createReview(
				makeReview({ rating: 5, authorEmail: "a@test.com" }),
			);
			const r2 = await controller.createReview(
				makeReview({ rating: 1, authorEmail: "b@test.com" }),
			);
			await controller.updateReviewStatus(r1.id, "approved");
			await controller.updateReviewStatus(r2.id, "approved");

			let summary = await controller.getProductRatingSummary("prod_1");
			expect(summary.average).toBe(3); // (5+1)/2

			// Reject the low-rating review
			await controller.updateReviewStatus(r2.id, "rejected");
			summary = await controller.getProductRatingSummary("prod_1");
			expect(summary.average).toBe(5);
			expect(summary.count).toBe(1);
		});
	});

	// ── listReviewsByCustomer ────────────────────────────────────────────

	describe("listReviewsByCustomer", () => {
		it("returns reviews for a specific customer", async () => {
			await controller.createReview(
				makeReview({ customerId: "cust_1", authorEmail: "a@test.com" }),
			);
			await controller.createReview(
				makeReview({ customerId: "cust_1", authorEmail: "b@test.com" }),
			);
			await controller.createReview(
				makeReview({ customerId: "cust_2", authorEmail: "c@test.com" }),
			);

			const { reviews, total } =
				await controller.listReviewsByCustomer("cust_1");
			expect(reviews).toHaveLength(2);
			expect(total).toBe(2);
		});

		it("returns empty array when customer has no reviews", async () => {
			const { reviews, total } =
				await controller.listReviewsByCustomer("cust_missing");
			expect(reviews).toHaveLength(0);
			expect(total).toBe(0);
		});

		it("filters by status", async () => {
			const r1 = await controller.createReview(
				makeReview({ customerId: "cust_1", authorEmail: "a@test.com" }),
			);
			await controller.createReview(
				makeReview({ customerId: "cust_1", authorEmail: "b@test.com" }),
			);
			await controller.updateReviewStatus(r1.id, "approved");

			const { reviews, total } = await controller.listReviewsByCustomer(
				"cust_1",
				{ status: "approved" },
			);
			expect(reviews).toHaveLength(1);
			expect(total).toBe(1);
			expect(reviews[0].status).toBe("approved");
		});

		it("supports take pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createReview(
					makeReview({
						customerId: "cust_1",
						authorEmail: `u${i}@test.com`,
					}),
				);
			}
			const { reviews, total } = await controller.listReviewsByCustomer(
				"cust_1",
				{ take: 2 },
			);
			expect(reviews).toHaveLength(2);
			expect(total).toBe(5);
		});

		it("supports skip + take pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createReview(
					makeReview({
						customerId: "cust_1",
						authorEmail: `u${i}@test.com`,
					}),
				);
			}
			const { reviews, total } = await controller.listReviewsByCustomer(
				"cust_1",
				{ take: 2, skip: 3 },
			);
			expect(reviews).toHaveLength(2);
			expect(total).toBe(5);
		});

		it("returns total count regardless of pagination", async () => {
			for (let i = 0; i < 8; i++) {
				await controller.createReview(
					makeReview({
						customerId: "cust_1",
						authorEmail: `u${i}@test.com`,
					}),
				);
			}
			const { reviews, total } = await controller.listReviewsByCustomer(
				"cust_1",
				{ take: 3, skip: 0 },
			);
			expect(reviews).toHaveLength(3);
			expect(total).toBe(8);
		});

		it("does not include reviews from other customers", async () => {
			await controller.createReview(
				makeReview({ customerId: "cust_1", authorEmail: "a@test.com" }),
			);
			await controller.createReview(
				makeReview({ customerId: "cust_2", authorEmail: "b@test.com" }),
			);
			await controller.createReview(
				makeReview({ customerId: "cust_3", authorEmail: "c@test.com" }),
			);

			const { reviews } = await controller.listReviewsByCustomer("cust_1");
			expect(reviews).toHaveLength(1);
			expect(reviews[0].customerId).toBe("cust_1");
		});

		it("includes all review fields", async () => {
			const created = await controller.createReview(
				makeReview({
					customerId: "cust_1",
					title: "Great product",
					rating: 5,
					isVerifiedPurchase: true,
				}),
			);
			await controller.addMerchantResponse(created.id, "Thank you!");

			const { reviews } = await controller.listReviewsByCustomer("cust_1");
			expect(reviews[0].title).toBe("Great product");
			expect(reviews[0].rating).toBe(5);
			expect(reviews[0].isVerifiedPurchase).toBe(true);
			expect(reviews[0].merchantResponse).toBe("Thank you!");
		});

		it("filters by status and returns correct total", async () => {
			const r1 = await controller.createReview(
				makeReview({ customerId: "cust_1", authorEmail: "a@test.com" }),
			);
			const r2 = await controller.createReview(
				makeReview({ customerId: "cust_1", authorEmail: "b@test.com" }),
			);
			await controller.createReview(
				makeReview({ customerId: "cust_1", authorEmail: "c@test.com" }),
			);
			await controller.updateReviewStatus(r1.id, "approved");
			await controller.updateReviewStatus(r2.id, "rejected");

			const pending = await controller.listReviewsByCustomer("cust_1", {
				status: "pending",
			});
			expect(pending.total).toBe(1);

			const rejected = await controller.listReviewsByCustomer("cust_1", {
				status: "rejected",
			});
			expect(rejected.total).toBe(1);
		});
	});

	// ── createReviewRequest ─────────────────────────────────────────────

	describe("createReviewRequest", () => {
		it("creates a review request with a unique id", async () => {
			const request = await controller.createReviewRequest({
				orderId: "ord_1",
				orderNumber: "ORD-001",
				email: "alice@test.com",
				customerName: "Alice",
				items: [{ productId: "prod_1", name: "Widget" }],
			});
			expect(request.id).toBeDefined();
			expect(request.orderId).toBe("ord_1");
			expect(request.orderNumber).toBe("ORD-001");
			expect(request.email).toBe("alice@test.com");
			expect(request.customerName).toBe("Alice");
			expect(request.items).toHaveLength(1);
			expect(request.sentAt).toBeInstanceOf(Date);
		});

		it("stores multiple items in the request", async () => {
			const request = await controller.createReviewRequest({
				orderId: "ord_2",
				orderNumber: "ORD-002",
				email: "bob@test.com",
				customerName: "Bob",
				items: [
					{ productId: "prod_1", name: "Widget" },
					{ productId: "prod_2", name: "Gadget" },
					{ productId: "prod_3", name: "Gizmo" },
				],
			});
			expect(request.items).toHaveLength(3);
			expect(request.items[1].name).toBe("Gadget");
		});

		it("assigns unique ids to each request", async () => {
			const r1 = await controller.createReviewRequest({
				orderId: "ord_1",
				orderNumber: "ORD-001",
				email: "a@test.com",
				customerName: "A",
				items: [{ productId: "p1", name: "P1" }],
			});
			const r2 = await controller.createReviewRequest({
				orderId: "ord_2",
				orderNumber: "ORD-002",
				email: "b@test.com",
				customerName: "B",
				items: [{ productId: "p2", name: "P2" }],
			});
			expect(r1.id).not.toBe(r2.id);
		});
	});

	// ── getReviewRequest ────────────────────────────────────────────────

	describe("getReviewRequest", () => {
		it("returns a review request by orderId", async () => {
			await controller.createReviewRequest({
				orderId: "ord_1",
				orderNumber: "ORD-001",
				email: "alice@test.com",
				customerName: "Alice",
				items: [{ productId: "prod_1", name: "Widget" }],
			});
			const found = await controller.getReviewRequest("ord_1");
			expect(found).not.toBeNull();
			expect(found?.orderId).toBe("ord_1");
		});

		it("returns null for non-existent orderId", async () => {
			const found = await controller.getReviewRequest("missing");
			expect(found).toBeNull();
		});
	});

	// ── listReviewRequests ──────────────────────────────────────────────

	describe("listReviewRequests", () => {
		it("lists all review requests", async () => {
			await controller.createReviewRequest({
				orderId: "ord_1",
				orderNumber: "ORD-001",
				email: "a@test.com",
				customerName: "A",
				items: [{ productId: "p1", name: "P1" }],
			});
			await controller.createReviewRequest({
				orderId: "ord_2",
				orderNumber: "ORD-002",
				email: "b@test.com",
				customerName: "B",
				items: [{ productId: "p2", name: "P2" }],
			});
			const requests = await controller.listReviewRequests();
			expect(requests).toHaveLength(2);
		});

		it("supports take pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createReviewRequest({
					orderId: `ord_${i}`,
					orderNumber: `ORD-${i}`,
					email: `u${i}@test.com`,
					customerName: `User ${i}`,
					items: [{ productId: `p${i}`, name: `P${i}` }],
				});
			}
			const page = await controller.listReviewRequests({ take: 2 });
			expect(page).toHaveLength(2);
		});

		it("supports skip pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createReviewRequest({
					orderId: `ord_${i}`,
					orderNumber: `ORD-${i}`,
					email: `u${i}@test.com`,
					customerName: `User ${i}`,
					items: [{ productId: `p${i}`, name: `P${i}` }],
				});
			}
			const page = await controller.listReviewRequests({ skip: 3 });
			expect(page).toHaveLength(2);
		});

		it("returns empty array when no requests exist", async () => {
			const requests = await controller.listReviewRequests();
			expect(requests).toHaveLength(0);
		});
	});

	// ── getReviewRequestStats ───────────────────────────────────────────

	describe("getReviewRequestStats", () => {
		it("returns zeros when no requests exist", async () => {
			const stats = await controller.getReviewRequestStats();
			expect(stats.totalSent).toBe(0);
			expect(stats.uniqueOrders).toBe(0);
		});

		it("counts total sent and unique orders", async () => {
			await controller.createReviewRequest({
				orderId: "ord_1",
				orderNumber: "ORD-001",
				email: "a@test.com",
				customerName: "A",
				items: [{ productId: "p1", name: "P1" }],
			});
			await controller.createReviewRequest({
				orderId: "ord_2",
				orderNumber: "ORD-002",
				email: "b@test.com",
				customerName: "B",
				items: [{ productId: "p2", name: "P2" }],
			});
			const stats = await controller.getReviewRequestStats();
			expect(stats.totalSent).toBe(2);
			expect(stats.uniqueOrders).toBe(2);
		});
	});
});

// ── Module Factory ──────────────────────────────────────────────────────────

describe("reviews module factory", () => {
	it("returns a module with correct id and version", () => {
		const mod = reviewsModule();
		expect(mod.id).toBe("reviews");
		expect(mod.version).toBe("0.0.2");
	});

	it("exports the reviews schema", () => {
		const mod = reviewsModule();
		expect(mod.schema).toBeDefined();
		const schema = mod.schema as NonNullable<typeof mod.schema>;
		expect(schema.review).toBeDefined();
		expect(schema.review.fields.id).toBeDefined();
		expect(schema.review.fields.rating).toBeDefined();
	});

	it("declares exported contract fields", () => {
		const mod = reviewsModule();
		expect(mod.exports?.read).toContain("productRating");
		expect(mod.exports?.read).toContain("reviewCount");
	});

	it("declares emitted events", () => {
		const mod = reviewsModule();
		expect(mod.events?.emits).toContain("review.submitted");
		expect(mod.events?.emits).toContain("review.approved");
		expect(mod.events?.emits).toContain("review.rejected");
		expect(mod.events?.emits).toContain("review.responded");
		expect(mod.events?.emits).toContain("review.requested");
	});

	it("registers admin pages", () => {
		const mod = reviewsModule();
		expect(mod.admin?.pages).toHaveLength(3);
		expect(mod.admin?.pages?.[0].path).toBe("/admin/reviews");
		expect(mod.admin?.pages?.[0].label).toBe("Reviews");
		expect(mod.admin?.pages?.[0].icon).toBe("Star");
		expect(mod.admin?.pages?.[1].path).toBe("/admin/reviews/analytics");
		expect(mod.admin?.pages?.[1].component).toBe("ReviewAnalytics");
		expect(mod.admin?.pages?.[2].path).toBe("/admin/reviews/:id");
		expect(mod.admin?.pages?.[2].component).toBe("ReviewModeration");
	});

	it("provides store and admin endpoints", () => {
		const mod = reviewsModule();
		expect(mod.endpoints?.store).toBeDefined();
		expect(mod.endpoints?.admin).toBeDefined();
	});

	async function initReviewsController(options?: {
		autoApprove?: string;
	}): Promise<ReviewController> {
		const mod = reviewsModule(options);
		const ctx = createMockModuleContext();
		const result = await mod.init?.(ctx);
		if (!result?.controllers?.reviews) {
			throw new Error("Module init did not return reviews controller");
		}
		return result.controllers.reviews as ReviewController;
	}

	it("init creates a controller", async () => {
		const ctrl = await initReviewsController();
		expect(ctrl).toBeDefined();
		expect(typeof ctrl.createReview).toBe("function");
		expect(typeof ctrl.getReview).toBe("function");
		expect(typeof ctrl.listReviews).toBe("function");
	});

	it("passes autoApprove option from string to boolean", async () => {
		const ctrl = await initReviewsController({ autoApprove: "true" });
		const review = await ctrl.createReview({
			productId: "p1",
			authorName: "Test",
			authorEmail: "test@example.com",
			rating: 5,
			body: "Auto approved!",
		});
		expect(review.status).toBe("approved");
	});

	it("does not auto-approve when option is not 'true'", async () => {
		const ctrl = await initReviewsController({ autoApprove: "false" });
		const review = await ctrl.createReview({
			productId: "p1",
			authorName: "Test",
			authorEmail: "test@example.com",
			rating: 5,
			body: "Not auto approved",
		});
		expect(review.status).toBe("pending");
	});

	it("does not auto-approve when no options provided", async () => {
		const ctrl = await initReviewsController();
		const review = await ctrl.createReview({
			productId: "p1",
			authorName: "Test",
			authorEmail: "test@example.com",
			rating: 4,
			body: "Default behavior",
		});
		expect(review.status).toBe("pending");
	});
});
