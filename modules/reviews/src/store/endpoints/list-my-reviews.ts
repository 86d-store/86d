import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ReviewController, ReviewStatus } from "../../service";

export const listMyReviews = createStoreEndpoint(
	"/reviews/me",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().positive().optional().default(1),
			limit: z.coerce.number().int().positive().max(50).optional().default(10),
			status: z.enum(["pending", "approved", "rejected"]).optional(),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const { page, limit, status } = ctx.query;
		const skip = (page - 1) * limit;

		const controller = ctx.context.controllers.reviews as ReviewController;
		const { reviews, total } = await controller.listReviewsByCustomer(userId, {
			status: status as ReviewStatus | undefined,
			take: limit,
			skip,
		});

		return {
			reviews,
			total,
			page,
			limit,
			pages: Math.ceil(total / limit),
		};
	},
);
