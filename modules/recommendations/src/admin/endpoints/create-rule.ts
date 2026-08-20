import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { RecommendationController } from "../../service";

export const createRule = createAdminEndpoint(
	"/admin/recommendations/rules/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			strategy: z.enum([
				"manual",
				"bought_together",
				"trending",
				"personalized",
			]),
			sourceProductId: z.string().optional(),
			targetProductIds: z.array(z.string()).min(1).max(100),
			weight: z.number().min(0).max(100).optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.recommendations as RecommendationController;

		const rule = await controller.createRule({
			name: ctx.body.name,
			strategy: ctx.body.strategy,
			sourceProductId: ctx.body.sourceProductId,
			targetProductIds: ctx.body.targetProductIds,
			weight: ctx.body.weight,
			isActive: ctx.body.isActive,
		});

		return { rule };
	},
);
