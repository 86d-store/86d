import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { RecommendationController } from "../../service";

export const getForProduct = createStoreEndpoint(
	"/recommendations/:productId",
	{
		method: "GET",
		params: z.object({ productId: z.string().max(200) }),
		query: z.object({
			strategy: z
				.enum([
					"manual",
					"bought_together",
					"trending",
					"personalized",
					"ai_similar",
				])
				.optional(),
			take: z.coerce.number().int().min(1).max(50).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.recommendations as RecommendationController;

		const defaultTake = Number(
			(ctx.context.options as Record<string, unknown>)?.defaultTake,
		);

		const recommendations = await controller.getForProduct(
			ctx.params.productId,
			{
				strategy: ctx.query.strategy,
				take:
					ctx.query.take ??
					(Number.isFinite(defaultTake) ? defaultTake : undefined),
			},
		);

		let impressionId: string | null = null;
		if (recommendations.length > 0) {
			const customerId = ctx.context.session?.user.id;
			const impression = await controller.recordImpression({
				surface: "for_product",
				sourceProductId: ctx.params.productId,
				customerId,
				productIds: recommendations.map((r) => r.productId),
				strategies: [...new Set(recommendations.map((r) => r.strategy))],
			});
			impressionId = impression.id;
		}

		return { recommendations, impressionId };
	},
);
