import { createAdminEndpoint } from "@86d-app/core/api";
import type { ReviewController } from "../../service";

export const reviewAnalytics = createAdminEndpoint(
	"/admin/reviews/analytics",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.reviews as ReviewController;
		const analytics = await controller.getReviewAnalytics();
		return { analytics };
	},
);
