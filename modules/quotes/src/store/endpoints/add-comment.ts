import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { QuoteController } from "../../service";

export const addCommentEndpoint = createStoreEndpoint(
	"/quotes/:id/comments/add",
	{
		method: "POST",
		params: z.object({
			id: z.string().max(200),
		}),
		body: z.object({
			quoteId: z.string().max(200).optional(),
			message: z.string().min(1).max(2000).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		const customerId = session?.user.id;
		if (!customerId) return { error: "Authentication required", status: 401 };

		const controller = ctx.context.controllers.quotes as QuoteController;
		const quoteId = ctx.params.id;
		if (ctx.body.quoteId && ctx.body.quoteId !== quoteId) {
			return { error: "Quote not found", status: 404 };
		}

		// Verify ownership before adding a comment
		const quote = await controller.getQuote(quoteId);
		if (!quote || quote.customerId !== customerId) {
			return { error: "Quote not found", status: 404 };
		}

		const comment = await controller.addComment({
			quoteId,
			authorType: "customer",
			authorId: customerId,
			authorName: sanitizeText(session.user.name || session.user.email),
			message: ctx.body.message,
		});
		return { comment };
	},
);
