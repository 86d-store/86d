import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ReviewController } from "../../service";

export const markHelpful = createStoreEndpoint(
	"/reviews/:id/helpful",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.reviews as ReviewController;
		const voterId = ctx.context.session?.user.id;

		// Authenticated users get vote deduplication
		if (voterId) {
			const result = await controller.voteHelpful(ctx.params.id, voterId);
			if (!result) return { error: "Review not found", status: 404 };
			if (result.alreadyVoted) {
				return {
					helpfulCount: result.review.helpfulCount,
					alreadyVoted: true,
				};
			}
			return {
				helpfulCount: result.review.helpfulCount,
				alreadyVoted: false,
			};
		}

		// Anonymous users: simple increment (no dedup possible)
		const review = await controller.markHelpful(ctx.params.id);
		if (!review) return { error: "Review not found", status: 404 };
		return { helpfulCount: review.helpfulCount, alreadyVoted: false };
	},
);
