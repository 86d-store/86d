import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FaqController } from "../../service";

export const deleteCategory = createAdminEndpoint(
	"/admin/faq/categories/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const faqController = ctx.context.controllers.faq as FaqController;

		await faqController.deleteCategory(ctx.params.id);

		return { success: true };
	},
);
