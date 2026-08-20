import { describe, expect, it, vi } from "vitest";
import { approveReview } from "../admin/endpoints/approve-review";
import { deleteReview } from "../admin/endpoints/delete-review";
import { getReview } from "../admin/endpoints/get-review";
import { listReports } from "../admin/endpoints/list-reports";
import { listReviewRequests } from "../admin/endpoints/list-review-requests";
import { listReviews } from "../admin/endpoints/list-reviews";
import { rejectReview } from "../admin/endpoints/reject-review";
import { respondReview } from "../admin/endpoints/respond-review";
import { reviewAnalytics } from "../admin/endpoints/review-analytics";
import { reviewRequestStats } from "../admin/endpoints/review-request-stats";
import { sendReviewRequest } from "../admin/endpoints/send-review-request";
import { updateReport } from "../admin/endpoints/update-report";
import type {
	Review,
	ReviewAnalytics,
	ReviewController,
	ReviewReport,
	ReviewRequest,
	ReviewRequestStats,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeReview(overrides: Partial<Review> = {}): Review {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		productId: "prod_1",
		authorName: "Alice",
		authorEmail: "alice@example.com",
		rating: 5,
		body: "Great product!",
		status: "pending",
		isVerifiedPurchase: true,
		helpfulCount: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeReport(overrides: Partial<ReviewReport> = {}): ReviewReport {
	return {
		id: crypto.randomUUID(),
		reviewId: "rev_1",
		reason: "spam",
		status: "pending",
		createdAt: new Date(),
		...overrides,
	};
}

function makeRequest(overrides: Partial<ReviewRequest> = {}): ReviewRequest {
	return {
		id: crypto.randomUUID(),
		orderId: "order_1",
		orderNumber: "ORD-001",
		email: "alice@example.com",
		customerName: "Alice",
		items: [{ productId: "prod_1", name: "Widget" }],
		sentAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<ReviewController> = {},
): ReviewController {
	return {
		createReview: vi.fn().mockResolvedValue(makeReview()),
		getReview: vi.fn().mockResolvedValue(null),
		listReviews: vi.fn().mockResolvedValue([]),
		updateReviewStatus: vi.fn().mockResolvedValue(null),
		deleteReview: vi.fn().mockResolvedValue(false),
		addMerchantResponse: vi.fn().mockResolvedValue(null),
		voteHelpful: vi.fn().mockResolvedValue(undefined),
		getReviewAnalytics: vi.fn().mockResolvedValue({
			totalReviews: 0,
			pendingCount: 0,
			approvedCount: 0,
			rejectedCount: 0,
			averageRating: 0,
			ratingsDistribution: {},
			withMerchantResponse: 0,
			reportedCount: 0,
		} satisfies ReviewAnalytics),
		createReviewRequest: vi.fn().mockResolvedValue(makeRequest()),
		getReviewRequest: vi.fn().mockResolvedValue(null),
		listReviewRequests: vi.fn().mockResolvedValue([]),
		getReviewRequestStats: vi.fn().mockResolvedValue({
			totalSent: 0,
			uniqueOrders: 0,
		} satisfies ReviewRequestStats),
		reportReview: vi.fn().mockResolvedValue(makeReport()),
		listReports: vi.fn().mockResolvedValue([]),
		updateReportStatus: vi.fn().mockResolvedValue(null),
		listReviewsByProduct: vi.fn().mockResolvedValue([]),
		getProductRatingSummary: vi.fn().mockResolvedValue({
			average: 0,
			count: 0,
			distribution: {},
		}),
		markHelpful: vi.fn().mockResolvedValue(null),
		listReviewsByCustomer: vi.fn().mockResolvedValue({ reviews: [], total: 0 }),
		hasReviewedProduct: vi.fn().mockResolvedValue(false),
		getReportCount: vi.fn().mockResolvedValue(0),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: ReviewController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { reviews: opts.controller ?? makeController() } },
	});
}

const listHandler = extractHandler(listReviews);
const getHandler = extractHandler(getReview);
const approveHandler = extractHandler(approveReview);
const rejectHandler = extractHandler(rejectReview);
const respondHandler = extractHandler(respondReview);
const deleteHandler = extractHandler(deleteReview);
const analyticsHandler = extractHandler(reviewAnalytics);
const listReportsHandler = extractHandler(listReports);
const updateReportHandler = extractHandler(updateReport);
const listRequestsHandler = extractHandler(listReviewRequests);
const sendRequestHandler = extractHandler(sendReviewRequest);
const requestStatsHandler = extractHandler(reviewRequestStats);

describe("admin GET /reviews", () => {
	it("returns empty list", async () => {
		const result = (await call(listHandler)) as {
			reviews: Review[];
			total: number;
		};
		expect(result.reviews).toHaveLength(0);
	});

	it("forwards status filter", async () => {
		const ctrl = makeController();
		await call(listHandler, { query: { status: "pending" }, controller: ctrl });
		expect(ctrl.listReviews).toHaveBeenCalledWith(
			expect.objectContaining({ status: "pending" }),
		);
	});
});

describe("admin GET /reviews/:id", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(getHandler, { params: { id: "missing" } })) as {
			error: string;
			status: number;
		};
		expect(result.status).toBe(404);
	});

	it("returns review when found", async () => {
		const review = makeReview({ id: "rev_1" });
		const ctrl = makeController({
			getReview: vi.fn().mockResolvedValue(review),
		});
		const result = (await call(getHandler, {
			params: { id: "rev_1" },
			controller: ctrl,
		})) as { review: Review };
		expect(result.review.id).toBe("rev_1");
	});
});

describe("admin POST /reviews/:id/approve", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(approveHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("approves review", async () => {
		const review = makeReview({ status: "approved" });
		const ctrl = makeController({
			updateReviewStatus: vi.fn().mockResolvedValue(review),
		});
		const result = (await call(approveHandler, {
			params: { id: review.id },
			controller: ctrl,
		})) as { review: Review };
		expect(result.review.status).toBe("approved");
		expect(ctrl.updateReviewStatus).toHaveBeenCalledWith(review.id, "approved");
	});
});

describe("admin POST /reviews/:id/reject", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(rejectHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("rejects review", async () => {
		const review = makeReview({ status: "rejected" });
		const ctrl = makeController({
			updateReviewStatus: vi.fn().mockResolvedValue(review),
		});
		const result = (await call(rejectHandler, {
			params: { id: review.id },
			controller: ctrl,
		})) as { review: Review };
		expect(result.review.status).toBe("rejected");
	});
});

describe("admin POST /reviews/:id/respond", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(respondHandler, {
			params: { id: "missing" },
			body: { response: "Thank you!" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("adds merchant response", async () => {
		const review = makeReview({ merchantResponse: "Thank you!" });
		const ctrl = makeController({
			addMerchantResponse: vi.fn().mockResolvedValue(review),
		});
		const result = (await call(respondHandler, {
			params: { id: review.id },
			body: { response: "Thank you!" },
			controller: ctrl,
		})) as { review: Review };
		expect(result.review.merchantResponse).toBe("Thank you!");
	});
});

describe("admin DELETE /reviews/:id", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes review", async () => {
		const review = makeReview({ id: "rev_1" });
		const ctrl = makeController({
			getReview: vi.fn().mockResolvedValue(review),
			deleteReview: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "rev_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

describe("admin GET /reviews/analytics", () => {
	it("returns analytics", async () => {
		const ctrl = makeController({
			getReviewAnalytics: vi.fn().mockResolvedValue({
				totalReviews: 100,
				pendingCount: 5,
				approvedCount: 90,
				rejectedCount: 5,
				averageRating: 4.2,
				ratingsDistribution: { "5": 60, "4": 20, "3": 10, "2": 5, "1": 5 },
				withMerchantResponse: 30,
				reportedCount: 2,
			}),
		});
		const result = (await call(analyticsHandler, { controller: ctrl })) as {
			analytics: ReviewAnalytics;
		};
		expect(result.analytics.totalReviews).toBe(100);
		expect(result.analytics.averageRating).toBe(4.2);
	});
});

describe("admin GET /reviews/reports", () => {
	it("returns empty list", async () => {
		const result = (await call(listReportsHandler)) as {
			reports: ReviewReport[];
		};
		expect(result.reports).toHaveLength(0);
	});
});

describe("admin POST /reviews/reports/:id/update", () => {
	it("returns 404 when report not found", async () => {
		const result = (await call(updateReportHandler, {
			params: { id: "missing" },
			body: { status: "resolved" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates report status", async () => {
		const report = makeReport({ status: "resolved" });
		const ctrl = makeController({
			updateReportStatus: vi.fn().mockResolvedValue(report),
		});
		const result = (await call(updateReportHandler, {
			params: { id: report.id },
			body: { status: "resolved" },
			controller: ctrl,
		})) as { report: ReviewReport };
		expect(result.report.status).toBe("resolved");
	});
});

describe("admin GET /reviews/requests", () => {
	it("returns empty list", async () => {
		const result = (await call(listRequestsHandler)) as {
			requests: ReviewRequest[];
		};
		expect(result.requests).toHaveLength(0);
	});
});

describe("admin POST /reviews/requests/send", () => {
	it("sends review request", async () => {
		const req = makeRequest({ orderId: "order_1" });
		const ctrl = makeController({
			createReviewRequest: vi.fn().mockResolvedValue(req),
		});
		const result = (await call(sendRequestHandler, {
			body: {
				orderId: "order_1",
				orderNumber: "ORD-001",
				email: "alice@example.com",
				customerName: "Alice",
				items: [{ productId: "prod_1", name: "Widget" }],
			},
			controller: ctrl,
		})) as { request: ReviewRequest };
		expect(result.request.orderId).toBe("order_1");
	});
});

describe("admin GET /reviews/requests/stats", () => {
	it("returns request stats", async () => {
		const ctrl = makeController({
			getReviewRequestStats: vi.fn().mockResolvedValue({
				totalSent: 42,
				uniqueOrders: 38,
			}),
		});
		const result = (await call(requestStatsHandler, { controller: ctrl })) as {
			stats: ReviewRequestStats;
		};
		expect(result.stats.totalSent).toBe(42);
	});
});
