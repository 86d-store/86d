import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ReviewController } from "../../service";

export const getReview = createAdminEndpoint(
	"/admin/reviews/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.reviews as ReviewController;
		const review = await controller.getReview(ctx.params.id);
		if (!review) return { error: "Review not found", status: 404 };
		return { review };
	},
);
