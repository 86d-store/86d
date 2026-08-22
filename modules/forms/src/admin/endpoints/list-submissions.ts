import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FormsController } from "../../service";

export const listSubmissions = createAdminEndpoint(
	"/admin/forms/:formId/submissions",
	{
		method: "GET",
		params: z.object({
			formId: z.string(),
		}),
		query: z.object({
			status: z.enum(["unread", "read", "spam", "archived"]).optional(),
			limit: z.string().optional(),
			offset: z.string().optional(),
		}),
	},
	async (ctx) => {
		const formsController = ctx.context.controllers.forms as FormsController;
		const { formId } = ctx.params;
		const { status, limit, offset } = ctx.query;

		const submissions = await formsController.listSubmissions({
			formId,
			status: status as "unread" | "read" | "spam" | "archived" | undefined,
			limit: limit ? Number.parseInt(limit, 10) : 50,
			offset: offset ? Number.parseInt(offset, 10) : 0,
		});

		return { submissions };
	},
);
