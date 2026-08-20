import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { RecommendationController } from "../../service";

export const getCoOccurrences = createAdminEndpoint(
	"/admin/recommendations/co-occurrences/:productId",
	{
		method: "GET",
		params: z.object({ productId: z.string().max(200) }),
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.recommendations as RecommendationController;

		const coOccurrences = await controller.getCoOccurrences(
			ctx.params.productId,
			{ take: ctx.query.take },
		);

		return { coOccurrences };
	},
);
