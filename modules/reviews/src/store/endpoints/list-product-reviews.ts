import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ReviewController, ReviewSortBy } from "../../service";

export const listProductReviews = createStoreEndpoint(
	"/reviews/products/:productId",
	{
		method: "GET",
		params: z.object({ productId: z.string().max(200) }),
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
			sortBy: z
				.enum(["recent", "oldest", "highest", "lowest", "helpful"])
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.reviews as ReviewController;
		const [reviews, summary] = await Promise.all([
			controller.listReviewsByProduct(ctx.params.productId, {
				approvedOnly: true,
				take: ctx.query.take ?? 20,
				skip: ctx.query.skip ?? 0,
				sortBy: (ctx.query.sortBy as ReviewSortBy | undefined) ?? "recent",
			}),
			controller.getProductRatingSummary(ctx.params.productId),
		]);
		return { reviews, summary, total: reviews.length };
	},
);
