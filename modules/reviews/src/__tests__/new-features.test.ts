import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
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
	} as Parameters<ReviewController["createReview"]>[0];
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("reviews new features", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createReviewController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createReviewController(mockData);
	});

	// ── Photo/Image Reviews ─────────────────────────────────────────────

	describe("photo reviews", () => {
		it("creates a review with images", async () => {
			const review = await controller.createReview(
				makeReview({
					images: [
						{ url: "https://example.com/photo1.jpg", caption: "Front view" },
						{ url: "https://example.com/photo2.jpg" },
					],
				}),
			);
			expect(review.images).toHaveLength(2);
			expect(review.images?.[0]?.url).toBe("https://example.com/photo1.jpg");
			expect(review.images?.[0]?.caption).toBe("Front view");
			expect(review.images?.[1]?.caption).toBeUndefined();
		});

		it("creates a review without images (backward compatible)", async () => {
			const review = await controller.createReview(makeReview());
			expect(review.images).toBeUndefined();
		});

		it("creates a review with empty images array (no images stored)", async () => {
			const review = await controller.createReview(makeReview({ images: [] }));
			expect(review.images).toBeUndefined();
		});

		it("persists images and retrieves them", async () => {
			const review = await controller.createReview(
				makeReview({
					images: [{ url: "https://example.com/pic.jpg", caption: "My photo" }],
				}),
			);
			const fetched = await controller.getReview(review.id);
			expect(fetched?.images).toHaveLength(1);
			expect(fetched?.images?.[0]?.url).toBe("https://example.com/pic.jpg");
		});

		it("images appear in product review listing", async () => {
			const autoCtrl = createReviewController(mockData, {
				autoApprove: true,
			});
			await autoCtrl.createReview(
				makeReview({
					images: [{ url: "https://example.com/review-pic.jpg" }],
				}),
			);
			const reviews = await autoCtrl.listReviewsByProduct("prod_1", {
				approvedOnly: true,
			});
			expect(reviews[0]?.images).toHaveLength(1);
		});
	});

	// ── Duplicate Review Prevention ─────────────────────────────────────

	describe("duplicate review prevention", () => {
		it("hasReviewedProduct returns false when customer has not reviewed product", async () => {
			const result = await controller.hasReviewedProduct("cust_1", "prod_1");
			expect(result).toBe(false);
		});

		it("hasReviewedProduct returns true when customer has reviewed product", async () => {
			await controller.createReview(
				makeReview({ customerId: "cust_1", productId: "prod_1" }),
			);
			const result = await controller.hasReviewedProduct("cust_1", "prod_1");
			expect(result).toBe(true);
		});

		it("hasReviewedProduct is product-specific", async () => {
			await controller.createReview(
				makeReview({ customerId: "cust_1", productId: "prod_1" }),
			);
			const result = await controller.hasReviewedProduct("cust_1", "prod_2");
			expect(result).toBe(false);
		});

		it("hasReviewedProduct is customer-specific", async () => {
			await controller.createReview(
				makeReview({ customerId: "cust_1", productId: "prod_1" }),
			);
			const result = await controller.hasReviewedProduct("cust_2", "prod_1");
			expect(result).toBe(false);
		});

		it("hasReviewedProduct returns true regardless of review status", async () => {
			const review = await controller.createReview(
				makeReview({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.updateReviewStatus(review.id, "rejected");
			const result = await controller.hasReviewedProduct("cust_1", "prod_1");
			expect(result).toBe(true);
		});
	});

	// ── Vote-Based Helpfulness ──────────────────────────────────────────

	describe("vote-based helpfulness (voteHelpful)", () => {
		it("records a vote and increments helpfulCount", async () => {
			const review = await controller.createReview(makeReview());
			const result = await controller.voteHelpful(review.id, "voter_1");
			expect(result).not.toBeNull();
			expect(result?.review.helpfulCount).toBe(1);
			expect(result?.alreadyVoted).toBe(false);
		});

		it("prevents duplicate votes from same voter", async () => {
			const review = await controller.createReview(makeReview());
			await controller.voteHelpful(review.id, "voter_1");
			const second = await controller.voteHelpful(review.id, "voter_1");
			expect(second?.alreadyVoted).toBe(true);
			expect(second?.review.helpfulCount).toBe(1); // not incremented
		});

		it("allows different voters on same review", async () => {
			const review = await controller.createReview(makeReview());
			await controller.voteHelpful(review.id, "voter_1");
			const second = await controller.voteHelpful(review.id, "voter_2");
			expect(second?.alreadyVoted).toBe(false);
			expect(second?.review.helpfulCount).toBe(2);
		});

		it("returns null for non-existent review", async () => {
			const result = await controller.voteHelpful("nonexistent_id", "voter_1");
			expect(result).toBeNull();
		});

		it("allows same voter on different reviews", async () => {
			const r1 = await controller.createReview(
				makeReview({ productId: "prod_1" }),
			);
			const r2 = await controller.createReview(
				makeReview({
					productId: "prod_2",
					authorEmail: "bob@test.com",
				}),
			);
			const v1 = await controller.voteHelpful(r1.id, "voter_1");
			const v2 = await controller.voteHelpful(r2.id, "voter_1");
			expect(v1?.alreadyVoted).toBe(false);
			expect(v2?.alreadyVoted).toBe(false);
		});

		it("vote dedup does not affect markHelpful (anonymous)", async () => {
			const review = await controller.createReview(makeReview());
			await controller.voteHelpful(review.id, "voter_1");
			// markHelpful still works (anonymous increment)
			const result = await controller.markHelpful(review.id);
			expect(result?.helpfulCount).toBe(2);
		});
	});

	// ── Review Sorting ──────────────────────────────────────────────────

	describe("review sorting", () => {
		let autoCtrl: ReturnType<typeof createReviewController>;

		beforeEach(() => {
			autoCtrl = createReviewController(mockData, { autoApprove: true });
		});

		it("sorts by recent (newest first)", async () => {
			// Manually set different createdAt timestamps to guarantee ordering
			const r1 = await autoCtrl.createReview(
				makeReview({ authorEmail: "a@test.com" }),
			);
			const r2 = await autoCtrl.createReview(
				makeReview({ authorEmail: "b@test.com" }),
			);
			const r3 = await autoCtrl.createReview(
				makeReview({ authorEmail: "c@test.com" }),
			);

			// Patch timestamps to ensure distinct ordering
			const stored1 = await autoCtrl.getReview(r1.id);
			const stored2 = await autoCtrl.getReview(r2.id);
			const stored3 = await autoCtrl.getReview(r3.id);
			if (stored1 && stored2 && stored3) {
				await mockData.upsert("review", r1.id, {
					...(stored1 as unknown as Record<string, unknown>),
					createdAt: new Date("2024-01-01"),
				});
				await mockData.upsert("review", r2.id, {
					...(stored2 as unknown as Record<string, unknown>),
					createdAt: new Date("2024-06-01"),
				});
				await mockData.upsert("review", r3.id, {
					...(stored3 as unknown as Record<string, unknown>),
					createdAt: new Date("2024-12-01"),
				});
			}

			const reviews = await autoCtrl.listReviewsByProduct("prod_1", {
				approvedOnly: true,
				sortBy: "recent",
			});
			expect(reviews[0]?.id).toBe(r3.id);
			expect(reviews[2]?.id).toBe(r1.id);
		});

		it("sorts by oldest first", async () => {
			const r1 = await autoCtrl.createReview(
				makeReview({ authorEmail: "a@test.com" }),
			);
			const r2 = await autoCtrl.createReview(
				makeReview({ authorEmail: "b@test.com" }),
			);
			const r3 = await autoCtrl.createReview(
				makeReview({ authorEmail: "c@test.com" }),
			);

			const stored1 = await autoCtrl.getReview(r1.id);
			const stored2 = await autoCtrl.getReview(r2.id);
			const stored3 = await autoCtrl.getReview(r3.id);
			if (stored1 && stored2 && stored3) {
				await mockData.upsert("review", r1.id, {
					...(stored1 as unknown as Record<string, unknown>),
					createdAt: new Date("2024-01-01"),
				});
				await mockData.upsert("review", r2.id, {
					...(stored2 as unknown as Record<string, unknown>),
					createdAt: new Date("2024-06-01"),
				});
				await mockData.upsert("review", r3.id, {
					...(stored3 as unknown as Record<string, unknown>),
					createdAt: new Date("2024-12-01"),
				});
			}

			const reviews = await autoCtrl.listReviewsByProduct("prod_1", {
				approvedOnly: true,
				sortBy: "oldest",
			});
			expect(reviews[0]?.id).toBe(r1.id);
		});

		it("sorts by highest rating", async () => {
			await autoCtrl.createReview(
				makeReview({ rating: 3, authorEmail: "a@test.com" }),
			);
			await autoCtrl.createReview(
				makeReview({ rating: 5, authorEmail: "b@test.com" }),
			);
			await autoCtrl.createReview(
				makeReview({ rating: 1, authorEmail: "c@test.com" }),
			);

			const reviews = await autoCtrl.listReviewsByProduct("prod_1", {
				approvedOnly: true,
				sortBy: "highest",
			});
			expect(reviews[0]?.rating).toBe(5);
			expect(reviews[1]?.rating).toBe(3);
			expect(reviews[2]?.rating).toBe(1);
		});

		it("sorts by lowest rating", async () => {
			await autoCtrl.createReview(
				makeReview({ rating: 3, authorEmail: "a@test.com" }),
			);
			await autoCtrl.createReview(
				makeReview({ rating: 5, authorEmail: "b@test.com" }),
			);
			await autoCtrl.createReview(
				makeReview({ rating: 1, authorEmail: "c@test.com" }),
			);

			const reviews = await autoCtrl.listReviewsByProduct("prod_1", {
				approvedOnly: true,
				sortBy: "lowest",
			});
			expect(reviews[0]?.rating).toBe(1);
			expect(reviews[2]?.rating).toBe(5);
		});

		it("sorts by most helpful", async () => {
			const r1 = await autoCtrl.createReview(
				makeReview({ authorEmail: "a@test.com" }),
			);
			const r2 = await autoCtrl.createReview(
				makeReview({ authorEmail: "b@test.com" }),
			);
			await autoCtrl.createReview(makeReview({ authorEmail: "c@test.com" }));

			await autoCtrl.markHelpful(r2.id);
			await autoCtrl.markHelpful(r2.id);
			await autoCtrl.markHelpful(r1.id);

			const reviews = await autoCtrl.listReviewsByProduct("prod_1", {
				approvedOnly: true,
				sortBy: "helpful",
			});
			expect(reviews[0]?.id).toBe(r2.id);
			expect(reviews[0]?.helpfulCount).toBe(2);
			expect(reviews[1]?.id).toBe(r1.id);
			expect(reviews[1]?.helpfulCount).toBe(1);
		});

		it("sorting works with pagination", async () => {
			await autoCtrl.createReview(
				makeReview({ rating: 1, authorEmail: "a@test.com" }),
			);
			await autoCtrl.createReview(
				makeReview({ rating: 5, authorEmail: "b@test.com" }),
			);
			await autoCtrl.createReview(
				makeReview({ rating: 3, authorEmail: "c@test.com" }),
			);

			const page1 = await autoCtrl.listReviewsByProduct("prod_1", {
				approvedOnly: true,
				sortBy: "highest",
				take: 2,
				skip: 0,
			});
			expect(page1).toHaveLength(2);
			expect(page1[0]?.rating).toBe(5);
			expect(page1[1]?.rating).toBe(3);

			const page2 = await autoCtrl.listReviewsByProduct("prod_1", {
				approvedOnly: true,
				sortBy: "highest",
				take: 2,
				skip: 2,
			});
			expect(page2).toHaveLength(1);
			expect(page2[0]?.rating).toBe(1);
		});

		it("without sortBy returns unsorted (default order)", async () => {
			await autoCtrl.createReview(
				makeReview({ rating: 3, authorEmail: "a@test.com" }),
			);
			await autoCtrl.createReview(
				makeReview({ rating: 5, authorEmail: "b@test.com" }),
			);

			const reviews = await autoCtrl.listReviewsByProduct("prod_1", {
				approvedOnly: true,
			});
			expect(reviews).toHaveLength(2);
		});
	});

	// ── Review Reporting ────────────────────────────────────────────────

	describe("review reporting", () => {
		it("creates a report for a review", async () => {
			const review = await controller.createReview(makeReview());
			const report = await controller.reportReview({
				reviewId: review.id,
				reporterId: "reporter_1",
				reason: "spam",
			});
			expect(report.id).toBeDefined();
			expect(report.reviewId).toBe(review.id);
			expect(report.reporterId).toBe("reporter_1");
			expect(report.reason).toBe("spam");
			expect(report.status).toBe("pending");
			expect(report.createdAt).toBeInstanceOf(Date);
		});

		it("creates a report with optional details", async () => {
			const review = await controller.createReview(makeReview());
			const report = await controller.reportReview({
				reviewId: review.id,
				reason: "offensive",
				details: "Contains inappropriate language",
			});
			expect(report.details).toBe("Contains inappropriate language");
		});

		it("creates a report without reporterId (anonymous)", async () => {
			const review = await controller.createReview(makeReview());
			const report = await controller.reportReview({
				reviewId: review.id,
				reason: "fake",
			});
			expect(report.reporterId).toBeUndefined();
		});

		it("allows multiple reports on the same review", async () => {
			const review = await controller.createReview(makeReview());
			await controller.reportReview({
				reviewId: review.id,
				reporterId: "reporter_1",
				reason: "spam",
			});
			await controller.reportReview({
				reviewId: review.id,
				reporterId: "reporter_2",
				reason: "offensive",
			});
			const reports = await controller.listReports({
				reviewId: review.id,
			});
			expect(reports).toHaveLength(2);
		});

		it("lists reports filtered by status", async () => {
			const review = await controller.createReview(makeReview());
			const r1 = await controller.reportReview({
				reviewId: review.id,
				reason: "spam",
			});
			await controller.reportReview({
				reviewId: review.id,
				reason: "fake",
			});
			await controller.updateReportStatus(r1.id, "resolved");

			const pending = await controller.listReports({ status: "pending" });
			expect(pending).toHaveLength(1);
			expect(pending[0]?.reason).toBe("fake");
		});

		it("updates report status to resolved", async () => {
			const review = await controller.createReview(makeReview());
			const report = await controller.reportReview({
				reviewId: review.id,
				reason: "spam",
			});
			const updated = await controller.updateReportStatus(
				report.id,
				"resolved",
			);
			expect(updated?.status).toBe("resolved");
		});

		it("updates report status to dismissed", async () => {
			const review = await controller.createReview(makeReview());
			const report = await controller.reportReview({
				reviewId: review.id,
				reason: "spam",
			});
			const updated = await controller.updateReportStatus(
				report.id,
				"dismissed",
			);
			expect(updated?.status).toBe("dismissed");
		});

		it("returns null when updating non-existent report", async () => {
			const result = await controller.updateReportStatus(
				"nonexistent",
				"resolved",
			);
			expect(result).toBeNull();
		});

		it("getReportCount returns pending report count", async () => {
			const review = await controller.createReview(makeReview());
			expect(await controller.getReportCount(review.id)).toBe(0);

			const r1 = await controller.reportReview({
				reviewId: review.id,
				reason: "spam",
			});
			await controller.reportReview({
				reviewId: review.id,
				reason: "fake",
			});
			expect(await controller.getReportCount(review.id)).toBe(2);

			await controller.updateReportStatus(r1.id, "resolved");
			expect(await controller.getReportCount(review.id)).toBe(1);
		});

		it("reports are review-specific", async () => {
			const r1 = await controller.createReview(
				makeReview({ productId: "prod_1" }),
			);
			const r2 = await controller.createReview(
				makeReview({
					productId: "prod_2",
					authorEmail: "bob@test.com",
				}),
			);

			await controller.reportReview({
				reviewId: r1.id,
				reason: "spam",
			});
			await controller.reportReview({
				reviewId: r2.id,
				reason: "fake",
			});

			const r1Reports = await controller.listReports({
				reviewId: r1.id,
			});
			expect(r1Reports).toHaveLength(1);
			expect(r1Reports[0]?.reason).toBe("spam");
		});

		it("listReports supports pagination", async () => {
			const review = await controller.createReview(makeReview());
			for (let i = 0; i < 5; i++) {
				await controller.reportReview({
					reviewId: review.id,
					reporterId: `reporter_${i}`,
					reason: "spam",
				});
			}
			const page = await controller.listReports({ take: 2 });
			expect(page).toHaveLength(2);
		});
	});

	// ── Analytics with Reports ──────────────────────────────────────────

	describe("analytics with reports", () => {
		it("analytics includes reportedCount", async () => {
			const r1 = await controller.createReview(
				makeReview({ authorEmail: "a@test.com" }),
			);
			await controller.createReview(makeReview({ authorEmail: "b@test.com" }));

			await controller.reportReview({
				reviewId: r1.id,
				reason: "spam",
			});

			const analytics = await controller.getReviewAnalytics();
			expect(analytics.reportedCount).toBe(1);
		});

		it("reportedCount only counts unique reviews with pending reports", async () => {
			const r1 = await controller.createReview(
				makeReview({ authorEmail: "a@test.com" }),
			);

			await controller.reportReview({
				reviewId: r1.id,
				reporterId: "rep_1",
				reason: "spam",
			});
			await controller.reportReview({
				reviewId: r1.id,
				reporterId: "rep_2",
				reason: "fake",
			});

			const analytics = await controller.getReviewAnalytics();
			expect(analytics.reportedCount).toBe(1); // same review, counted once
		});

		it("resolved reports not counted in reportedCount", async () => {
			const r1 = await controller.createReview(
				makeReview({ authorEmail: "a@test.com" }),
			);
			const report = await controller.reportReview({
				reviewId: r1.id,
				reason: "spam",
			});
			await controller.updateReportStatus(report.id, "resolved");

			const analytics = await controller.getReviewAnalytics();
			expect(analytics.reportedCount).toBe(0);
		});
	});

	// ── Module Factory ──────────────────────────────────────────────────

	describe("module factory", () => {
		it("exports new types in module type exports", async () => {
			// Import the module to verify it compiles and exports
			const mod = await import("../index");
			const module = mod.default();
			expect(module.id).toBe("reviews");
			expect(module.version).toBe("0.0.2");
		});

		it("declares review.reported event", async () => {
			const mod = await import("../index");
			const module = mod.default();
			expect(module.events?.emits).toContain("review.reported");
		});

		it("schema includes reviewVote and reviewReport tables", async () => {
			const mod = await import("../index");
			const module = mod.default();
			expect(module.schema).toHaveProperty("reviewVote");
			expect(module.schema).toHaveProperty("reviewReport");
		});
	});
});
