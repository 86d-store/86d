import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { ProductQaController } from "../../service";

export const postOfficialAnswer = createAdminEndpoint(
	"/admin/product-qa/questions/:id/answer",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			authorName: z.string().max(200).transform(sanitizeText),
			authorEmail: z.string().email(),
			body: z.string().max(5000).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.productQa as ProductQaController;

		const question = await controller.getQuestion(ctx.params.id);
		if (!question) {
			return { error: "Question not found" };
		}

		const answer = await controller.createAnswer({
			questionId: ctx.params.id,
			productId: question.productId,
			authorName: ctx.body.authorName,
			authorEmail: ctx.body.authorEmail,
			body: ctx.body.body,
			isOfficial: true,
		});
		return { answer };
	},
);
