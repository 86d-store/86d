import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ProductQaController } from "../../service";

export const listProductQuestions = createStoreEndpoint(
	"/product-qa/products/:productId/questions",
	{
		method: "GET",
		params: z.object({
			productId: z.string().max(200),
		}),
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.productQa as ProductQaController;
		const questions = await controller.listQuestionsByProduct(
			ctx.params.productId,
			{
				publishedOnly: true,
				take: ctx.query.take,
				skip: ctx.query.skip,
			},
		);

		// Also fetch answers for each question
		const questionsWithAnswers = await Promise.all(
			questions.map(async (q) => {
				const answers = await controller.listAnswersByQuestion(q.id, {
					publishedOnly: true,
				});
				return { ...q, answers };
			}),
		);

		return { questions: questionsWithAnswers };
	},
);
