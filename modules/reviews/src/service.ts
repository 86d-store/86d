import type { ModuleController } from "@86d-app/core/types/module";

/**
 * Minimal interface for checking purchase history.
 * Reviews accesses the orders controller through the runtime context —
 * no direct module import, just a structural contract.
 */
export type OrderPurchaseController = {
	hasCustomerPurchasedProduct(
		customerId: string,
		productId: string,
	): Promise<boolean>;
};

export type ReviewStatus = "pending" | "approved" | "rejected";
export type ReportStatus = "pending" | "resolved" | "dismissed";
export type ReviewSortBy =
	| "recent"
	| "oldest"
	| "highest"
	| "lowest"
	| "helpful";

export type ReviewImage = {
	url: string;
	caption?: string | undefined;
};

export type Review = {
	id: string;
	productId: string;
	customerId?: string | undefined;
	authorName: string;
	authorEmail: string;
	rating: number;
	title?: string | undefined;
	body: string;
	status: ReviewStatus;
	isVerifiedPurchase: boolean;
	helpfulCount: number;
	images?: ReviewImage[] | undefined;
	merchantResponse?: string | undefined;
	merchantResponseAt?: Date | undefined;
	moderationNote?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type RatingSummary = {
	average: number;
	count: number;
	distribution: Record<string, number>;
};

export type ReviewVote = {
	id: string;
	reviewId: string;
	voterId: string;
	createdAt: Date;
};

export type ReviewReport = {
	id: string;
	reviewId: string;
	reporterId?: string | undefined;
	reason: string;
	details?: string | undefined;
	status: ReportStatus;
	createdAt: Date;
};

export type ReviewController = ModuleController & {
	createReview(params: {
		productId: string;
		authorName: string;
		authorEmail: string;
		rating: number;
		title?: string | undefined;
		body: string;
		customerId?: string | undefined;
		isVerifiedPurchase?: boolean | undefined;
		images?: ReviewImage[] | undefined;
	}): Promise<Review>;

	getReview(id: string): Promise<Review | null>;

	listReviewsByProduct(
		productId: string,
		params?: {
			approvedOnly?: boolean | undefined;
			take?: number | undefined;
			skip?: number | undefined;
			sortBy?: ReviewSortBy | undefined;
		},
	): Promise<Review[]>;

	listReviews(params?: {
		productId?: string | undefined;
		status?: ReviewStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Review[]>;

	updateReviewStatus(
		id: string,
		status: ReviewStatus,
		moderationNote?: string | undefined,
	): Promise<Review | null>;

	deleteReview(id: string): Promise<boolean>;

	getProductRatingSummary(productId: string): Promise<RatingSummary>;

	addMerchantResponse(id: string, response: string): Promise<Review | null>;

	markHelpful(id: string): Promise<Review | null>;

	voteHelpful(
		reviewId: string,
		voterId: string,
	): Promise<{ review: Review; alreadyVoted: boolean } | null>;

	getReviewAnalytics(): Promise<ReviewAnalytics>;

	createReviewRequest(params: {
		orderId: string;
		orderNumber: string;
		email: string;
		customerName: string;
		items: Array<{ productId: string; name: string }>;
	}): Promise<ReviewRequest>;

	getReviewRequest(orderId: string): Promise<ReviewRequest | null>;

	listReviewRequests(params?: {
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<ReviewRequest[]>;

	getReviewRequestStats(): Promise<ReviewRequestStats>;

	listReviewsByCustomer(
		customerId: string,
		params?: {
			status?: ReviewStatus | undefined;
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<{ reviews: Review[]; total: number }>;

	hasReviewedProduct(customerId: string, productId: string): Promise<boolean>;

	reportReview(params: {
		reviewId: string;
		reporterId?: string | undefined;
		reason: string;
		details?: string | undefined;
	}): Promise<ReviewReport>;

	listReports(params?: {
		status?: ReportStatus | undefined;
		reviewId?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<ReviewReport[]>;

	updateReportStatus(
		id: string,
		status: ReportStatus,
	): Promise<ReviewReport | null>;

	getReportCount(reviewId: string): Promise<number>;
};

export type ReviewAnalytics = {
	totalReviews: number;
	pendingCount: number;
	approvedCount: number;
	rejectedCount: number;
	averageRating: number;
	ratingsDistribution: Record<string, number>;
	withMerchantResponse: number;
	reportedCount: number;
};

export type ReviewRequest = {
	id: string;
	orderId: string;
	orderNumber: string;
	email: string;
	customerName: string;
	items: Array<{ productId: string; name: string }>;
	sentAt: Date;
};

export type ReviewRequestStats = {
	totalSent: number;
	uniqueOrders: number;
};
