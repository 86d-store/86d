import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ProductQaController } from "../../service";

export const upvoteAnswer = createStoreEndpoint(
	"/product-qa/answers/:id/upvote",
	{
		method: "POST",
		params: z.object({
			id: z.string().max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.productQa as ProductQaController;
		const answer = await controller.upvoteAnswer(ctx.params.id);
		if (!answer) {
			return { error: "Answer not found", status: 404 };
		}
		return { answer };
	},
);
