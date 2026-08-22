import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { QuoteController } from "../../service";

export const declineQuoteEndpoint = createStoreEndpoint(
	"/quotes/:id/decline",
	{
		method: "POST",
		params: z.object({
			id: z.string().max(200),
		}),
		body: z.object({
			quoteId: z.string().max(200).optional(),
			reason: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.quotes as QuoteController;
		const quoteId = ctx.params.id;
		if (ctx.body.quoteId && ctx.body.quoteId !== quoteId) {
			return { error: "Quote not found", status: 404 };
		}

		// Verify ownership BEFORE mutating
		const existing = await controller.getQuote(quoteId);
		if (
			!existing ||
			(existing.customerId && existing.customerId !== session.user.id)
		) {
			return { error: "Quote not found", status: 404 };
		}

		const quote = await controller.declineQuote(quoteId, ctx.body.reason);
		if (!quote) return { error: "Cannot decline this quote", status: 422 };

		return { quote };
	},
);
