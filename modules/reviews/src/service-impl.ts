import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Review,
	ReviewController,
	ReviewReport,
	ReviewRequest,
	ReviewSortBy,
	ReviewStatus,
	ReviewVote,
} from "./service";

function sortReviews(reviews: Review[], sortBy: ReviewSortBy): Review[] {
	const sorted = [...reviews];
	switch (sortBy) {
		case "recent":
			return sorted.sort(
				(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
			);
		case "oldest":
			return sorted.sort(
				(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
			);
		case "highest":
			return sorted.sort((a, b) => b.rating - a.rating);
		case "lowest":
			return sorted.sort((a, b) => a.rating - b.rating);
		case "helpful":
			return sorted.sort((a, b) => b.helpfulCount - a.helpfulCount);
		default:
			return sorted;
	}
}

export function createReviewController(
	data: ModuleDataService,
	options?: { autoApprove?: boolean },
): ReviewController {
	return {
		async createReview(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const status: ReviewStatus =
				options?.autoApprove === true ? "approved" : "pending";
			const review: Review = {
				id,
				productId: params.productId,
				customerId: params.customerId,
				authorName: params.authorName,
				authorEmail: params.authorEmail,
				rating: params.rating,
				title: params.title,
				body: params.body,
				status,
				isVerifiedPurchase: params.isVerifiedPurchase ?? false,
				helpfulCount: 0,
				...(params.images && params.images.length > 0
					? { images: params.images }
					: {}),
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("review", id, review as Record<string, unknown>);
			return review;
		},

		async getReview(id) {
			const raw = await data.get("review", id);
			if (!raw) return null;
			return raw as unknown as Review;
		},

		async listReviewsByProduct(productId, params) {
			const where: Record<string, unknown> = { productId };
			if (params?.approvedOnly) where.status = "approved";

			const all = await data.findMany("review", {
				where,
			});
			let reviews = all as unknown as Review[];

			if (params?.sortBy) {
				reviews = sortReviews(reviews, params.sortBy);
			}

			const skip = params?.skip ?? 0;
			const take = params?.take;
			if (skip > 0 || take !== undefined) {
				reviews = reviews.slice(
					skip,
					take !== undefined ? skip + take : undefined,
				);
			}

			return reviews;
		},

		async listReviews(params) {
			const where: Record<string, unknown> = {};
			if (params?.productId) where.productId = params.productId;
			if (params?.status) where.status = params.status;

			const all = await data.findMany("review", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as Review[];
		},

		async updateReviewStatus(id, status, moderationNote) {
			const existing = await data.get("review", id);
			if (!existing) return null;
			const review = existing as unknown as Review;
			const updated: Review = {
				...review,
				status,
				updatedAt: new Date(),
				...(moderationNote !== undefined ? { moderationNote } : {}),
			};
			await data.upsert("review", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteReview(id) {
			const existing = await data.get("review", id);
			if (!existing) return false;
			await data.delete("review", id);
			return true;
		},

		async addMerchantResponse(id, response) {
			const existing = await data.get("review", id);
			if (!existing) return null;
			const review = existing as unknown as Review;
			const updated: Review = {
				...review,
				merchantResponse: response,
				merchantResponseAt: new Date(),
				updatedAt: new Date(),
			};
			await data.upsert("review", id, updated as Record<string, unknown>);
			return updated;
		},

		async markHelpful(id) {
			const existing = await data.get("review", id);
			if (!existing) return null;
			const review = existing as unknown as Review;
			const updated: Review = {
				...review,
				helpfulCount: review.helpfulCount + 1,
				updatedAt: new Date(),
			};
			await data.upsert("review", id, updated as Record<string, unknown>);
			return updated;
		},

		async voteHelpful(reviewId, voterId) {
			const existing = await data.get("review", reviewId);
			if (!existing) return null;
			const review = existing as unknown as Review;

			// Check if voter already voted
			const existingVotes = await data.findMany("reviewVote", {
				where: { reviewId, voterId },
				take: 1,
			});
			const votes = existingVotes as unknown as ReviewVote[];

			if (votes.length > 0) {
				return { review, alreadyVoted: true };
			}

			// Record the vote
			const voteId = crypto.randomUUID();
			const vote: ReviewVote = {
				id: voteId,
				reviewId,
				voterId,
				createdAt: new Date(),
			};
			await data.upsert("reviewVote", voteId, vote as Record<string, unknown>);

			// Increment helpful count
			const updated: Review = {
				...review,
				helpfulCount: review.helpfulCount + 1,
				updatedAt: new Date(),
			};
			await data.upsert("review", reviewId, updated as Record<string, unknown>);

			return { review: updated, alreadyVoted: false };
		},

		async getReviewAnalytics() {
			const all = await data.findMany("review", {});
			const reviews = all as unknown as Review[];

			const distribution: Record<string, number> = {
				"1": 0,
				"2": 0,
				"3": 0,
				"4": 0,
				"5": 0,
			};
			let pendingCount = 0;
			let approvedCount = 0;
			let rejectedCount = 0;
			let ratingTotal = 0;
			let withMerchantResponse = 0;

			for (const r of reviews) {
				if (r.status === "pending") pendingCount++;
				else if (r.status === "approved") approvedCount++;
				else if (r.status === "rejected") rejectedCount++;

				ratingTotal += r.rating;
				const key = String(r.rating);
				if (key in distribution) {
					distribution[key] = (distribution[key] ?? 0) + 1;
				}
				if (r.merchantResponse) withMerchantResponse++;
			}

			// Count reported reviews
			const allReports = await data.findMany("reviewReport", {
				where: { status: "pending" },
			});
			const reports = allReports as unknown as ReviewReport[];
			const reportedReviewIds = new Set(reports.map((r) => r.reviewId));

			return {
				totalReviews: reviews.length,
				pendingCount,
				approvedCount,
				rejectedCount,
				averageRating:
					reviews.length > 0
						? Math.round((ratingTotal / reviews.length) * 10) / 10
						: 0,
				ratingsDistribution: distribution,
				withMerchantResponse,
				reportedCount: reportedReviewIds.size,
			};
		},

		async getProductRatingSummary(productId) {
			const all = await data.findMany("review", {
				where: { productId, status: "approved" },
			});
			const reviews = all as unknown as Review[];
			if (reviews.length === 0) {
				return {
					average: 0,
					count: 0,
					distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
				};
			}
			const distribution: Record<string, number> = {
				"1": 0,
				"2": 0,
				"3": 0,
				"4": 0,
				"5": 0,
			};
			let total = 0;
			for (const r of reviews) {
				total += r.rating;
				const key = String(r.rating);
				if (key in distribution) {
					distribution[key] = (distribution[key] ?? 0) + 1;
				}
			}
			const average = Math.round((total / reviews.length) * 10) / 10;
			return { average, count: reviews.length, distribution };
		},

		async createReviewRequest(params) {
			const id = crypto.randomUUID();
			const request: ReviewRequest = {
				id,
				orderId: params.orderId,
				orderNumber: params.orderNumber,
				email: params.email,
				customerName: params.customerName,
				items: params.items,
				sentAt: new Date(),
			};
			await data.upsert(
				"reviewRequest",
				id,
				request as Record<string, unknown>,
			);
			return request;
		},

		async getReviewRequest(orderId) {
			const all = await data.findMany("reviewRequest", {
				where: { orderId },
				take: 1,
			});
			const requests = all as unknown as ReviewRequest[];
			return requests.length > 0 ? requests[0] : null;
		},

		async listReviewRequests(params) {
			const all = await data.findMany("reviewRequest", {
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as ReviewRequest[];
		},

		async listReviewsByCustomer(customerId, params) {
			const where: Record<string, unknown> = { customerId };
			if (params?.status) where.status = params.status;

			const all = await data.findMany("review", {
				where,
			});
			const reviews = all as unknown as Review[];

			const filtered = reviews.slice(
				params?.skip ?? 0,
				params?.skip !== undefined && params?.take !== undefined
					? params.skip + params.take
					: params?.take !== undefined
						? params.take
						: undefined,
			);

			return { reviews: filtered, total: reviews.length };
		},

		async hasReviewedProduct(customerId, productId) {
			const all = await data.findMany("review", {
				where: { customerId, productId },
				take: 1,
			});
			const reviews = all as unknown as Review[];
			return reviews.length > 0;
		},

		async reportReview(params) {
			const id = crypto.randomUUID();
			const report: ReviewReport = {
				id,
				reviewId: params.reviewId,
				reporterId: params.reporterId,
				reason: params.reason,
				details: params.details,
				status: "pending",
				createdAt: new Date(),
			};
			await data.upsert("reviewReport", id, report as Record<string, unknown>);
			return report;
		},

		async listReports(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.reviewId) where.reviewId = params.reviewId;

			const all = await data.findMany("reviewReport", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as ReviewReport[];
		},

		async updateReportStatus(id, status) {
			const existing = await data.get("reviewReport", id);
			if (!existing) return null;
			const report = existing as unknown as ReviewReport;
			const updated: ReviewReport = {
				...report,
				status,
			};
			await data.upsert("reviewReport", id, updated as Record<string, unknown>);
			return updated;
		},

		async getReportCount(reviewId) {
			const all = await data.findMany("reviewReport", {
				where: { reviewId, status: "pending" },
			});
			const reports = all as unknown as ReviewReport[];
			return reports.length;
		},

		async getReviewRequestStats() {
			const all = await data.findMany("reviewRequest", {});
			const requests = all as unknown as ReviewRequest[];
			const uniqueOrders = new Set(requests.map((r) => r.orderId));
			return {
				totalSent: requests.length,
				uniqueOrders: uniqueOrders.size,
			};
		},
	};
}
