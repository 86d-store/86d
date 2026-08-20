import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ProductQaController } from "../../service";

export const deleteQuestion = createAdminEndpoint(
	"/admin/product-qa/questions/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.productQa as ProductQaController;
		const deleted = await controller.deleteQuestion(ctx.params.id);
		if (!deleted) {
			return { error: "Question not found" };
		}
		return { success: true };
	},
);
