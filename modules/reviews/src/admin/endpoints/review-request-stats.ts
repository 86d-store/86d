import { createAdminEndpoint } from "@86d-store/core/api";
import type { ReviewController } from "../../service";

export const reviewRequestStats = createAdminEndpoint(
	"/admin/reviews/request-stats",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers.reviews as ReviewController;
		const stats = await controller.getReviewRequestStats();
		return { stats };
	},
);
