import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FormsController } from "../../service";

export const bulkDeleteSubmissions = createAdminEndpoint(
	"/admin/forms/submissions/bulk-delete",
	{
		method: "POST",
		body: z.object({
			ids: z.array(z.string().max(200)).min(1).max(500),
		}),
	},
	async (ctx) => {
		const formsController = ctx.context.controllers.forms as FormsController;
		const deleted = await formsController.bulkDeleteSubmissions(ctx.body.ids);

		return { deleted };
	},
);
