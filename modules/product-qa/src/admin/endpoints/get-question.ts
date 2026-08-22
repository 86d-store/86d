import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ProductQaController } from "../../service";

export const getQuestion = createAdminEndpoint(
	"/admin/product-qa/questions/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.productQa as ProductQaController;
		const question = await controller.getQuestion(ctx.params.id);
		if (!question) {
			return { error: "Question not found" };
		}
		const answers = await controller.listAnswersByQuestion(question.id);
		return { question, answers };
	},
);
