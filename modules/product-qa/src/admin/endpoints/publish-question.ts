import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ProductQaController } from "../../service";

export const publishQuestion = createAdminEndpoint(
	"/admin/product-qa/questions/:id/publish",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.productQa as ProductQaController;
		const question = await controller.updateQuestionStatus(
			ctx.params.id,
			"published",
		);
		if (!question) {
			return { error: "Question not found" };
		}
		return { question };
	},
);
