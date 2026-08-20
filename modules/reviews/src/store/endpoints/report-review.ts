import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { ReviewController } from "../../service";

export const reportReview = createStoreEndpoint(
	"/reviews/:id/report",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
		body: z.object({
			reason: z.enum([
				"spam",
				"offensive",
				"fake",
				"irrelevant",
				"harassment",
				"other",
			]),
			details: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.reviews as ReviewController;

		// Verify review exists
		const review = await controller.getReview(ctx.params.id);
		if (!review) return { error: "Review not found", status: 404 };

		const reporterId = ctx.context.session?.user.id;

		const report = await controller.reportReview({
			reviewId: ctx.params.id,
			reporterId,
			reason: ctx.body.reason,
			details: ctx.body.details,
		});
		return { report };
	},
);
