import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { ProductQaController } from "../../service";

export const submitQuestion = createStoreEndpoint(
	"/product-qa/questions",
	{
		method: "POST",
		body: z.object({
			productId: z.string().max(200),
			authorName: z.string().max(200).transform(sanitizeText),
			authorEmail: z.string().email().max(320),
			body: z.string().max(5000).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.productQa as ProductQaController;
		const customerId = ctx.context.session?.user.id;
		// Use session email when authenticated to prevent spoofing
		const authorEmail = customerId
			? (ctx.context.session?.user.email ?? ctx.body.authorEmail)
			: ctx.body.authorEmail;

		const question = await controller.createQuestion({
			productId: ctx.body.productId,
			authorName: ctx.body.authorName,
			authorEmail,
			body: ctx.body.body,
			customerId,
		});
		return { question };
	},
);
