import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { RecommendationController } from "../../service";

export const generateEmbedding = createAdminEndpoint(
	"/admin/recommendations/embeddings/generate",
	{
		method: "POST",
		body: z.object({
			productId: z.string().min(1).max(200),
			text: z.string().min(1).max(8000),
			productName: z.string().max(500).optional(),
			productSlug: z.string().max(500).optional(),
			productImage: z.string().max(2000).optional(),
			productPrice: z.number().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.recommendations as RecommendationController;

		const result = await controller.generateProductEmbedding(
			ctx.body.productId,
			ctx.body.text,
			{
				productName: ctx.body.productName,
				productSlug: ctx.body.productSlug,
				productImage: ctx.body.productImage,
				productPrice: ctx.body.productPrice,
			},
		);

		if (!result) {
			return {
				error:
					"AI recommendations not configured. Set OPENAI_API_KEY or OPENROUTER_API_KEY.",
				status: 400,
			};
		}

		return {
			embedding: {
				id: result.id,
				productId: result.productId,
				createdAt: result.createdAt,
			},
		};
	},
);
