import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ReviewController } from "../../service";

export const deleteReview = createAdminEndpoint(
	"/admin/reviews/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.reviews as ReviewController;
		const existing = await controller.getReview(ctx.params.id);
		if (!existing) return { error: "Review not found", status: 404 };
		const deleted = await controller.deleteReview(ctx.params.id);
		return { deleted };
	},
);
