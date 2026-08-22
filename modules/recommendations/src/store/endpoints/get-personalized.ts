import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { RecommendationController } from "../../service";

export const getPersonalized = createStoreEndpoint(
	"/recommendations/personalized",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(50).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.recommendations as RecommendationController;
		const customerId = ctx.context.session?.user.id;

		if (!customerId) {
			return { error: "Authentication required", status: 401 };
		}

		const defaultTake = Number(
			(ctx.context.options as Record<string, unknown>).defaultTake,
		);

		const recommendations = await controller.getPersonalized(customerId, {
			take:
				ctx.query.take ??
				(Number.isFinite(defaultTake) ? defaultTake : undefined),
		});

		let impressionId: string | null = null;
		if (recommendations.length > 0) {
			const impression = await controller.recordImpression({
				surface: "personalized",
				customerId,
				productIds: recommendations.map((r) => r.productId),
				strategies: [...new Set(recommendations.map((r) => r.strategy))],
			});
			impressionId = impression.id;
		}

		return { recommendations, impressionId };
	},
);
