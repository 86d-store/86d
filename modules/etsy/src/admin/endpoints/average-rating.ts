import { createAdminEndpoint } from "@86d-app/core/api";
import type { EtsyController } from "../../service";

export const averageRatingEndpoint = createAdminEndpoint(
	"/admin/etsy/reviews/average",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.etsy as EtsyController;
		const averageRating = await controller.getAverageRating();
		return { averageRating };
	},
);
