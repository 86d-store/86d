import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { Review, ReviewReport } from "../service";
import { createReviewController } from "../service-impl";

/**
 * Store endpoint integration tests for the reviews module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. submit-review: duplicate prevention for authenticated users,
 *    session email enforcement, guest submissions
 * 2. list-product-reviews: approved-only filtering, rating summary,
 *    sorting (recent/oldest/highest/lowest/helpful)
 * 3. list-my-reviews: auth guard, pagination calculation
 * 4. mark-helpful: auth-conditional vote dedup vs anonymous increment
 * 5. report-review: existence check, anonymous vs authenticated reports
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate store endpoint logic ─────────────────────────────────────

/**
 * Simulates submit-review endpoint: duplicate prevention for auth users,
 * forces session email for authenticated, allows body email for guests.
 */
async function simulateSubmitReview(
	data: DataService,
	body: {
		productId: string;
		authorName: string;
		authorEmail: string;
		rating: number;
		title?: string;
		body: string;
		images?: Array<{ url: string; caption?: string }>;
	},
	session?: { user: { id: string; email: string } },
) {
	const controller = createReviewController(data);
	const customerId = session?.user.id;

	if (customerId) {
		const alreadyReviewed = await controller.hasReviewedProduct(
			customerId,
			body.productId,
		);
		if (alreadyReviewed) {
			return { error: "You have already reviewed this product", status: 409 };
		}
	}

	const authorEmail = session ? session.user.email : body.authorEmail;

	const review = await controller.createReview({
		productId: body.productId,
		authorName: body.authorName,
		authorEmail,
		rating: body.rating,
		title: body.title,
		body: body.body,
		customerId,
		isVerifiedPurchase: false,
		images: body.images,
	});
	return { review };
}

/**
 * Simulates list-product-reviews endpoint: parallel fetch of
 * approved-only reviews + rating summary.
 */
async function simulateListProductReviews(
	data: DataService,
	productId: string,
	query: {
		take?: number;
		skip?: number;
		sortBy?: "recent" | "oldest" | "highest" | "lowest" | "helpful";
	} = {},
) {
	const controller = createReviewController(data);
	const [reviews, summary] = await Promise.all([
		controller.listReviewsByProduct(productId, {
			approvedOnly: true,
			take: query.take ?? 20,
			skip: query.skip ?? 0,
			sortBy: query.sortBy ?? "recent",
		}),
		controller.getProductRatingSummary(productId),
	]);
	return { reviews, summary, total: reviews.length };
}

/**
 * Simulates list-my-reviews endpoint: auth guard + pagination.
 */
async function simulateListMyReviews(
	data: DataService,
	query: {
		page?: number;
		limit?: number;
		status?: "pending" | "approved" | "rejected";
	} = {},
	userId?: string,
) {
	if (!userId) {
		return { error: "Unauthorized", status: 401 };
	}

	const page = query.page ?? 1;
	const limit = query.limit ?? 10;
	const skip = (page - 1) * limit;

	const controller = createReviewController(data);
	const { reviews, total } = await controller.listReviewsByCustomer(userId, {
		status: query.status,
		take: limit,
		skip,
	});

	return { reviews, total, page, limit, pages: Math.ceil(total / limit) };
}

/**
 * Simulates mark-helpful endpoint: auth users get vote dedup,
 * anonymous users get simple increment.
 */
async function simulateMarkHelpful(
	data: DataService,
	reviewId: string,
	voterId?: string,
) {
	const controller = createReviewController(data);

	if (voterId) {
		const result = await controller.voteHelpful(reviewId, voterId);
		if (!result) return { error: "Review not found", status: 404 };
		if (result.alreadyVoted) {
			return {
				helpfulCount: result.review.helpfulCount,
				alreadyVoted: true,
			};
		}
		return {
			helpfulCount: result.review.helpfulCount,
			alreadyVoted: false,
		};
	}

	const review = await controller.markHelpful(reviewId);
	if (!review) return { error: "Review not found", status: 404 };
	return { helpfulCount: review.helpfulCount, alreadyVoted: false };
}

/**
 * Simulates report-review endpoint: existence check, allows
 * anonymous reports.
 */
async function simulateReportReview(
	data: DataService,
	reviewId: string,
	body: {
		reason: string;
		details?: string;
	},
	reporterId?: string,
) {
	const controller = createReviewController(data);

	const review = await controller.getReview(reviewId);
	if (!review) return { error: "Review not found", status: 404 };

	const report = await controller.reportReview({
		reviewId,
		reporterId,
		reason: body.reason,
		details: body.details,
	});
	return { report };
}

// ── Helpers ───────────────────────────────────────────────────────────

async function seedReview(
	data: DataService,
	overrides: Partial<{
		productId: string;
		rating: number;
		status: "pending" | "approved" | "rejected";
		customerId: string;
		authorName: string;
		authorEmail: string;
		helpfulCount: number;
	}> = {},
): Promise<Review> {
	const controller = createReviewController(
		data,
		overrides.status === "approved" ? { autoApprove: true } : undefined,
	);
	const review = await controller.createReview({
		productId: overrides.productId ?? "prod-1",
		authorName: overrides.authorName ?? "Tester",
		authorEmail: overrides.authorEmail ?? "tester@example.com",
		rating: overrides.rating ?? 4,
		body: "Great product",
		customerId: overrides.customerId,
	});

	// Override status if not handled by autoApprove
	if (overrides.status && overrides.status !== "approved") {
		await controller.updateReviewStatus(review.id, overrides.status);
	}

	// Manually set helpfulCount if provided
	if (overrides.helpfulCount) {
		const raw = (await data.get("review", review.id)) as Review;
		const updated = {
			...raw,
			helpfulCount: overrides.helpfulCount,
		};
		await data.upsert("review", review.id, updated as Record<string, unknown>);
		return updated;
	}

	// Re-read to get final state
	return (await data.get("review", review.id)) as unknown as Review;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("reviews store endpoints", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	// ── submit-review ────────────────────────────────────────────────

	describe("submit-review", () => {
		it("allows guest to submit review with body email", async () => {
			const result = await simulateSubmitReview(data, {
				productId: "prod-1",
				authorName: "Guest User",
				authorEmail: "guest@example.com",
				rating: 5,
				body: "Love it!",
			});

			const res = result as { review: Review };
			expect(res.review.authorEmail).toBe("guest@example.com");
			expect(res.review.customerId).toBeUndefined();
			expect(res.review.rating).toBe(5);
		});

		it("forces session email for authenticated users", async () => {
			const result = await simulateSubmitReview(
				data,
				{
					productId: "prod-1",
					authorName: "Auth User",
					authorEmail: "fake@hacker.com", // Should be ignored
					rating: 4,
					body: "Nice product",
				},
				{ user: { id: "cust-1", email: "real@example.com" } },
			);

			const res = result as { review: Review };
			expect(res.review.authorEmail).toBe("real@example.com");
			expect(res.review.customerId).toBe("cust-1");
		});

		it("prevents duplicate review from same authenticated customer", async () => {
			const session = { user: { id: "cust-1", email: "user@example.com" } };

			await simulateSubmitReview(
				data,
				{
					productId: "prod-1",
					authorName: "User",
					authorEmail: "user@example.com",
					rating: 5,
					body: "First review",
				},
				session,
			);

			const second = await simulateSubmitReview(
				data,
				{
					productId: "prod-1",
					authorName: "User",
					authorEmail: "user@example.com",
					rating: 3,
					body: "Trying to review again",
				},
				session,
			);

			expect(second).toEqual({
				error: "You have already reviewed this product",
				status: 409,
			});
		});

		it("allows same customer to review different products", async () => {
			const session = { user: { id: "cust-1", email: "user@example.com" } };

			const first = await simulateSubmitReview(
				data,
				{
					productId: "prod-1",
					authorName: "User",
					authorEmail: "user@example.com",
					rating: 5,
					body: "Product 1 review",
				},
				session,
			);
			expect("review" in first).toBe(true);

			const second = await simulateSubmitReview(
				data,
				{
					productId: "prod-2",
					authorName: "User",
					authorEmail: "user@example.com",
					rating: 4,
					body: "Product 2 review",
				},
				session,
			);
			expect("review" in second).toBe(true);
		});

		it("allows guests to submit multiple reviews for same product", async () => {
			// Guests have no customerId — no dedup check
			const first = await simulateSubmitReview(data, {
				productId: "prod-1",
				authorName: "Guest A",
				authorEmail: "a@example.com",
				rating: 5,
				body: "Review 1",
			});
			const second = await simulateSubmitReview(data, {
				productId: "prod-1",
				authorName: "Guest B",
				authorEmail: "b@example.com",
				rating: 3,
				body: "Review 2",
			});

			expect("review" in first).toBe(true);
			expect("review" in second).toBe(true);
		});

		it("includes images in review when provided", async () => {
			const result = await simulateSubmitReview(data, {
				productId: "prod-1",
				authorName: "Photo User",
				authorEmail: "photo@example.com",
				rating: 5,
				body: "Check out these pics!",
				images: [
					{ url: "https://img.example.com/1.jpg", caption: "Front view" },
					{ url: "https://img.example.com/2.jpg" },
				],
			});

			const res = result as { review: Review };
			expect(res.review.images).toHaveLength(2);
			expect(res.review.images?.[0].caption).toBe("Front view");
		});
	});

	// ── list-product-reviews ─────────────────────────────────────────

	describe("list-product-reviews", () => {
		it("only returns approved reviews", async () => {
			await seedReview(data, {
				productId: "prod-1",
				status: "approved",
				rating: 5,
			});
			await seedReview(data, {
				productId: "prod-1",
				status: "pending",
				rating: 3,
			});
			await seedReview(data, {
				productId: "prod-1",
				status: "rejected",
				rating: 1,
			});

			const result = await simulateListProductReviews(data, "prod-1");
			expect(result.reviews).toHaveLength(1);
			expect(result.reviews[0].rating).toBe(5);
		});

		it("returns rating summary alongside reviews", async () => {
			await seedReview(data, {
				productId: "prod-1",
				status: "approved",
				rating: 5,
			});
			await seedReview(data, {
				productId: "prod-1",
				status: "approved",
				rating: 3,
			});

			const result = await simulateListProductReviews(data, "prod-1");
			expect(result.summary.count).toBe(2);
			expect(result.summary.average).toBe(4);
			expect(result.summary.distribution["5"]).toBe(1);
			expect(result.summary.distribution["3"]).toBe(1);
		});

		it("returns empty results for product with no reviews", async () => {
			const result = await simulateListProductReviews(data, "no-reviews");
			expect(result.reviews).toHaveLength(0);
			expect(result.summary.count).toBe(0);
			expect(result.summary.average).toBe(0);
			expect(result.total).toBe(0);
		});

		it("sorts by highest rating", async () => {
			await seedReview(data, {
				productId: "prod-1",
				status: "approved",
				rating: 2,
			});
			await seedReview(data, {
				productId: "prod-1",
				status: "approved",
				rating: 5,
			});
			await seedReview(data, {
				productId: "prod-1",
				status: "approved",
				rating: 3,
			});

			const result = await simulateListProductReviews(data, "prod-1", {
				sortBy: "highest",
			});
			expect(result.reviews[0].rating).toBe(5);
			expect(result.reviews[2].rating).toBe(2);
		});

		it("sorts by most helpful", async () => {
			await seedReview(data, {
				productId: "prod-1",
				status: "approved",
				helpfulCount: 1,
			});
			await seedReview(data, {
				productId: "prod-1",
				status: "approved",
				helpfulCount: 10,
			});

			const result = await simulateListProductReviews(data, "prod-1", {
				sortBy: "helpful",
			});
			expect(result.reviews[0].helpfulCount).toBe(10);
			expect(result.reviews[1].helpfulCount).toBe(1);
		});
	});

	// ── list-my-reviews ──────────────────────────────────────────────

	describe("list-my-reviews", () => {
		it("returns 401 for unauthenticated user", async () => {
			const result = await simulateListMyReviews(data);
			expect(result).toEqual({ error: "Unauthorized", status: 401 });
		});

		it("returns paginated reviews for authenticated user", async () => {
			await seedReview(data, {
				customerId: "cust-1",
				status: "approved",
			});
			await seedReview(data, {
				customerId: "cust-1",
				status: "pending",
			});

			const result = await simulateListMyReviews(data, {}, "cust-1");
			const res = result as {
				reviews: Review[];
				total: number;
				page: number;
				limit: number;
				pages: number;
			};
			expect(res.total).toBe(2);
			expect(res.page).toBe(1);
			expect(res.pages).toBe(1);
		});

		it("calculates pages correctly", async () => {
			// Seed 3 reviews for cust-1
			for (let i = 0; i < 3; i++) {
				await seedReview(data, { customerId: "cust-1", status: "approved" });
			}

			const result = await simulateListMyReviews(data, { limit: 2 }, "cust-1");
			const res = result as {
				reviews: Review[];
				total: number;
				pages: number;
			};
			expect(res.total).toBe(3);
			expect(res.pages).toBe(2); // ceil(3/2) = 2
		});

		it("does not return another customer's reviews", async () => {
			await seedReview(data, { customerId: "cust-other" });

			const result = await simulateListMyReviews(data, {}, "cust-1");
			const res = result as { reviews: Review[]; total: number };
			expect(res.total).toBe(0);
		});
	});

	// ── mark-helpful ─────────────────────────────────────────────────

	describe("mark-helpful", () => {
		it("increments helpful count for anonymous user", async () => {
			const review = await seedReview(data, { status: "approved" });

			const result = await simulateMarkHelpful(data, review.id);
			expect(result).toMatchObject({
				helpfulCount: 1,
				alreadyVoted: false,
			});
		});

		it("anonymous votes are not deduplicated", async () => {
			const review = await seedReview(data, { status: "approved" });

			await simulateMarkHelpful(data, review.id);
			const result = await simulateMarkHelpful(data, review.id);
			expect(result).toMatchObject({ helpfulCount: 2 });
		});

		it("increments helpful count for first authenticated vote", async () => {
			const review = await seedReview(data, { status: "approved" });

			const result = await simulateMarkHelpful(data, review.id, "voter-1");
			expect(result).toMatchObject({
				helpfulCount: 1,
				alreadyVoted: false,
			});
		});

		it("deduplicates authenticated votes", async () => {
			const review = await seedReview(data, { status: "approved" });

			await simulateMarkHelpful(data, review.id, "voter-1");
			const result = await simulateMarkHelpful(data, review.id, "voter-1");
			expect(result).toMatchObject({
				helpfulCount: 1,
				alreadyVoted: true,
			});
		});

		it("different authenticated voters can each vote", async () => {
			const review = await seedReview(data, { status: "approved" });

			await simulateMarkHelpful(data, review.id, "voter-1");
			const result = await simulateMarkHelpful(data, review.id, "voter-2");
			expect(result).toMatchObject({
				helpfulCount: 2,
				alreadyVoted: false,
			});
		});

		it("returns 404 for nonexistent review", async () => {
			const result = await simulateMarkHelpful(data, "no-such-review");
			expect(result).toEqual({ error: "Review not found", status: 404 });
		});

		it("returns 404 for nonexistent review with auth voter", async () => {
			const result = await simulateMarkHelpful(
				data,
				"no-such-review",
				"voter-1",
			);
			expect(result).toEqual({ error: "Review not found", status: 404 });
		});
	});

	// ── report-review ────────────────────────────────────────────────

	describe("report-review", () => {
		it("creates report for existing review", async () => {
			const review = await seedReview(data, { status: "approved" });

			const result = await simulateReportReview(data, review.id, {
				reason: "spam",
				details: "This looks like spam",
			});

			const res = result as { report: ReviewReport };
			expect(res.report.reviewId).toBe(review.id);
			expect(res.report.reason).toBe("spam");
			expect(res.report.status).toBe("pending");
		});

		it("returns 404 for nonexistent review", async () => {
			const result = await simulateReportReview(data, "no-such-review", {
				reason: "fake",
			});
			expect(result).toEqual({ error: "Review not found", status: 404 });
		});

		it("allows anonymous reports (no reporterId)", async () => {
			const review = await seedReview(data, { status: "approved" });

			const result = await simulateReportReview(data, review.id, {
				reason: "offensive",
			});

			const res = result as { report: ReviewReport };
			expect(res.report.reporterId).toBeUndefined();
		});

		it("includes reporterId for authenticated users", async () => {
			const review = await seedReview(data, { status: "approved" });

			const result = await simulateReportReview(
				data,
				review.id,
				{ reason: "harassment" },
				"reporter-1",
			);

			const res = result as { report: ReviewReport };
			expect(res.report.reporterId).toBe("reporter-1");
		});
	});
});
