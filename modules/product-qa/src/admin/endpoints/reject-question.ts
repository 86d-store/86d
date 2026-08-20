import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ProductQaController } from "../../service";

export const rejectQuestion = createAdminEndpoint(
	"/admin/product-qa/questions/:id/reject",
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
			"rejected",
		);
		if (!question) {
			return { error: "Question not found" };
		}
		return { question };
	},
);
