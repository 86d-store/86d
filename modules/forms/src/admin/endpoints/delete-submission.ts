import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FormsController } from "../../service";

export const deleteSubmission = createAdminEndpoint(
	"/admin/forms/submissions/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const formsController = ctx.context.controllers.forms as FormsController;
		await formsController.deleteSubmission(ctx.params.id);

		return { success: true };
	},
);
