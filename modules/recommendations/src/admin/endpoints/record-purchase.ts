import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { RecommendationController } from "../../service";

export const recordPurchase = createAdminEndpoint(
	"/admin/recommendations/record-purchase",
	{
		method: "POST",
		body: z.object({
			productIds: z.array(z.string()).min(2).max(50),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.recommendations as RecommendationController;

		const pairsRecorded = await controller.recordPurchase(ctx.body.productIds);

		return { pairsRecorded };
	},
);
