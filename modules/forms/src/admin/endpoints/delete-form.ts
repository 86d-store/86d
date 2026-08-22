import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FormsController } from "../../service";

export const deleteForm = createAdminEndpoint(
	"/admin/forms/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const formsController = ctx.context.controllers.forms as FormsController;
		await formsController.deleteForm(ctx.params.id);

		return { success: true };
	},
);
