import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FormsController } from "../../service";

export const getStats = createAdminEndpoint(
	"/admin/forms/stats",
	{
		method: "GET",
		query: z.object({
			formId: z.string().optional(),
		}),
	},
	async (ctx) => {
		const formsController = ctx.context.controllers.forms as FormsController;
		const stats = await formsController.getStats(ctx.query.formId);

		return { stats };
	},
);
