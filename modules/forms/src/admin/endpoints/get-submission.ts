import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FormsController } from "../../service";

export const getSubmission = createAdminEndpoint(
	"/admin/forms/submissions/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const formsController = ctx.context.controllers.forms as FormsController;
		const submission = await formsController.getSubmission(ctx.params.id);

		if (!submission) {
			return { error: "Submission not found", status: 404 };
		}

		// Auto-mark as read when viewing
		if (submission.status === "unread") {
			const updated = await formsController.updateSubmissionStatus(
				ctx.params.id,
				"read",
			);
			return { submission: updated };
		}

		return { submission };
	},
);
