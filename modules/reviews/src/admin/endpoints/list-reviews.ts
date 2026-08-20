import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ReviewController, ReviewStatus } from "../../service";

export const listReviews = createAdminEndpoint(
	"/admin/reviews",
	{
		method: "GET",
		query: z.object({
			status: z.enum(["pending", "approved", "rejected"]).optional(),
			productId: z.string().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.reviews as ReviewController;
		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;
		const all = await controller.listReviews({
			status: ctx.query.status as ReviewStatus | undefined,
			productId: ctx.query.productId,
		});
		const total = all.length;
		const reviews = all.slice(skip, skip + take);
		return { reviews, total };
	},
);
