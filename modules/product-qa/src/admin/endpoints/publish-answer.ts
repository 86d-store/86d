import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ProductQaController } from "../../service";

export const publishAnswer = createAdminEndpoint(
	"/admin/product-qa/answers/:id/publish",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.productQa as ProductQaController;
		const answer = await controller.updateAnswerStatus(
			ctx.params.id,
			"published",
		);
		if (!answer) {
			return { error: "Answer not found" };
		}
		return { answer };
	},
);
