import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ProductQaController } from "../../service";

export const listAnswers = createStoreEndpoint(
	"/product-qa/questions/:questionId/answers",
	{
		method: "GET",
		params: z.object({
			questionId: z.string().max(200),
		}),
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.productQa as ProductQaController;
		const answers = await controller.listAnswersByQuestion(
			ctx.params.questionId,
			{
				publishedOnly: true,
				take: ctx.query.take,
				skip: ctx.query.skip,
			},
		);
		return { answers };
	},
);
