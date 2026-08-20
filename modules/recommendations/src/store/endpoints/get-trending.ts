import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { RecommendationController } from "../../service";

export const getTrending = createStoreEndpoint(
	"/recommendations/trending",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(50).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.recommendations as RecommendationController;

		const opts = ctx.context.options as Record<string, unknown>;
		const defaultTake = Number(opts?.defaultTake);
		const windowDays = Number(opts?.trendingWindowDays);
		const since = Number.isFinite(windowDays)
			? new Date(Date.now() - windowDays * 86_400_000)
			: undefined;

		const recommendations = await controller.getTrending({
			take:
				ctx.query.take ??
				(Number.isFinite(defaultTake) ? defaultTake : undefined),
			since,
		});

		let impressionId: string | null = null;
		if (recommendations.length > 0) {
			const customerId = ctx.context.session?.user.id;
			const impression = await controller.recordImpression({
				surface: "trending",
				customerId,
				productIds: recommendations.map((r) => r.productId),
				strategies: [...new Set(recommendations.map((r) => r.strategy))],
			});
			impressionId = impression.id;
		}

		return { recommendations, impressionId };
	},
);
