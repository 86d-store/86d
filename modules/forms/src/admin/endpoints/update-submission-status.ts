import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FormsController } from "../../service";

export const updateSubmissionStatus = createAdminEndpoint(
	"/admin/forms/submissions/:id/status",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			status: z.enum(["unread", "read", "spam", "archived"]),
		}),
	},
	async (ctx) => {
		const formsController = ctx.context.controllers.forms as FormsController;
		const submission = await formsController.updateSubmissionStatus(
			ctx.params.id,
			ctx.body.status,
		);

		return { submission };
	},
);
