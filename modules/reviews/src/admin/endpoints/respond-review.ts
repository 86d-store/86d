import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { ReviewController } from "../../service";

export const respondReview = createAdminEndpoint(
	"/admin/reviews/:id/respond",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			response: z.string().min(1).max(5000).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.reviews as ReviewController;
		const review = await controller.addMerchantResponse(
			ctx.params.id,
			ctx.body.response,
		);
		if (!review) return { error: "Review not found", status: 404 };
		void ctx.context.events?.emit("review.responded", {
			reviewId: review.id,
			productId: review.productId,
			customerId: review.customerId,
			authorEmail: review.authorEmail,
		});
		return { review };
	},
);
