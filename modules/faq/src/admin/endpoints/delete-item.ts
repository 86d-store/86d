import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FaqController } from "../../service";

export const deleteItem = createAdminEndpoint(
	"/admin/faq/items/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const faqController = ctx.context.controllers.faq as FaqController;

		await faqController.deleteItem(ctx.params.id);

		return { success: true };
	},
);
