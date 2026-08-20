import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ProductQaController } from "../../service";

export const rejectAnswer = createAdminEndpoint(
	"/admin/product-qa/answers/:id/reject",
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
			"rejected",
		);
		if (!answer) {
			return { error: "Answer not found" };
		}
		return { answer };
	},
);
