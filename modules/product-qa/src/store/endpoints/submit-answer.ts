import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { ProductQaController } from "../../service";

export const submitAnswer = createStoreEndpoint(
	"/product-qa/questions/:questionId/answer",
	{
		method: "POST",
		params: z.object({
			questionId: z.string().max(200),
		}),
		body: z.object({
			authorName: z.string().max(200).transform(sanitizeText),
			authorEmail: z.string().email().max(320),
			body: z.string().max(5000).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.productQa as ProductQaController;

		// Verify question exists
		const question = await controller.getQuestion(ctx.params.questionId);
		if (!question) {
			return { error: "Question not found", status: 404 };
		}

		const customerId = ctx.context.session?.user.id;
		// Use session email when authenticated to prevent spoofing
		const authorEmail = customerId
			? (ctx.context.session?.user.email ?? ctx.body.authorEmail)
			: ctx.body.authorEmail;

		const answer = await controller.createAnswer({
			questionId: ctx.params.questionId,
			productId: question.productId,
			authorName: ctx.body.authorName,
			authorEmail,
			body: ctx.body.body,
			customerId,
		});
		return { answer };
	},
);
