import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { RecommendationController } from "../../service";

export const recordClick = createStoreEndpoint(
	"/recommendations/click",
	{
		method: "POST",
		body: z.object({
			impressionId: z.string().min(1).max(200),
			productId: z.string().min(1).max(200),
			position: z.number().int().min(0).max(1000),
			strategy: z
				.enum([
					"manual",
					"bought_together",
					"trending",
					"personalized",
					"ai_similar",
				])
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.recommendations as RecommendationController;

		const click = await controller.recordClick({
			impressionId: ctx.body.impressionId,
			productId: ctx.body.productId,
			position: ctx.body.position,
			strategy: ctx.body.strategy,
		});

		if (!click) {
			return { error: "Impression not found", status: 404 };
		}

		return { id: click.id };
	},
);
