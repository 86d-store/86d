import { acceptCapability } from "@86d-app/core/capabilities";
import { orderPurchaseVerifyCapability } from "@86d-app/core/commerce-capabilities";
import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { reviewsStorage } from "./schema";
import { createReviewController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	RatingSummary,
	ReportStatus,
	Review,
	ReviewAnalytics,
	ReviewController,
	ReviewImage,
	ReviewReport,
	ReviewRequest,
	ReviewRequestStats,
	ReviewSortBy,
	ReviewStatus,
	ReviewVote,
} from "./service";

export interface ReviewsOptions extends ModuleConfig {
	/** Auto-approve reviews (no moderation queue) */
	autoApprove?: string;
}

export default function reviews(options?: ReviewsOptions): Module {
	return {
		id: "reviews",
		version: "0.0.2",
		storage: reviewsStorage,
		capabilities: {
			accepts: [
				acceptCapability(orderPurchaseVerifyCapability, { optional: true }),
			],
		},
		exports: {
			read: ["productRating", "reviewCount"],
		},
		events: {
			emits: [
				"review.submitted",
				"review.approved",
				"review.rejected",
				"review.responded",
				"review.requested",
				"review.reported",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createReviewController(ctx.data, {
				autoApprove: options?.autoApprove === "true",
			});
			return { controllers: { reviews: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/reviews",
					component: "ReviewList",
					label: "Reviews",
					icon: "Star",
					group: "Marketing",
				},
				{
					path: "/admin/reviews/analytics",
					component: "ReviewAnalytics",
					label: "Review Analytics",
					icon: "ChartBar",
					group: "Marketing",
				},
				{
					path: "/admin/reviews/:id",
					component: "ReviewModeration",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/account/reviews",
					component: "MyReviewsPage",
				},
			],
		},
		options,
	};
}
