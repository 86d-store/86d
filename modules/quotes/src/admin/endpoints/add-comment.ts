import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { QuoteController } from "../../service";

export const addCommentAdminEndpoint = createAdminEndpoint(
	"/admin/quotes/:id/comments/add",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
		body: z.object({
			authorName: z.string().min(1).max(200).transform(sanitizeText),
			message: z.string().min(1).max(2000).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.quotes as QuoteController;
		const comment = await controller.addComment({
			quoteId: ctx.params.id,
			authorType: "admin",
			authorId: "admin",
			authorName: ctx.body.authorName,
			message: ctx.body.message,
		});
		return { comment };
	},
);
