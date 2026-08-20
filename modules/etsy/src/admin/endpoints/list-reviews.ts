import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { EtsyController } from "../../service";

export const listReviewsEndpoint = createAdminEndpoint(
	"/admin/etsy/reviews",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.etsy as EtsyController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listReviews({});
		const total = all.length;
		const reviews = all.slice(skip, skip + limit);
		return { reviews, total };
	},
);
