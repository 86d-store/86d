import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ProductQaController } from "../../service";

export const upvoteQuestion = createStoreEndpoint(
	"/product-qa/questions/:id/upvote",
	{
		method: "POST",
		params: z.object({
			id: z.string().max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.productQa as ProductQaController;
		const question = await controller.upvoteQuestion(ctx.params.id);
		if (!question) {
			return { error: "Question not found", status: 404 };
		}
		return { question };
	},
);
