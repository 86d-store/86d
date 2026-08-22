import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ReviewController } from "../../service";

export const listReviewRequests = createAdminEndpoint(
	"/admin/reviews/requests",
	{
		method: "GET",
		query: z
			.object({
				take: z.coerce.number().optional(),
				skip: z.coerce.number().optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.reviews as ReviewController;
		const requests = await controller.listReviewRequests({
			take: ctx.query?.take,
			skip: ctx.query?.skip,
		});
		return { requests };
	},
);
