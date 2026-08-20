import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ProductQaController } from "../../service";

export const deleteAnswer = createAdminEndpoint(
	"/admin/product-qa/answers/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.productQa as ProductQaController;
		const deleted = await controller.deleteAnswer(ctx.params.id);
		if (!deleted) {
			return { error: "Answer not found" };
		}
		return { success: true };
	},
);
