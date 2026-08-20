import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ReviewController } from "../../service";

export const rejectReview = createAdminEndpoint(
	"/admin/reviews/:id/reject",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.reviews as ReviewController;
		const review = await controller.updateReviewStatus(
			ctx.params.id,
			"rejected",
		);
		if (!review) return { error: "Review not found", status: 404 };
		void ctx.context.events?.emit("review.rejected", {
			reviewId: review.id,
			productId: review.productId,
			customerId: review.customerId,
			authorEmail: review.authorEmail,
			rating: review.rating,
		});
		return { review };
	},
);
