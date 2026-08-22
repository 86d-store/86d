import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { QuoteController } from "../../service";

export const rejectQuoteEndpoint = createAdminEndpoint(
	"/admin/quotes/:id/reject",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
		body: z.object({
			reason: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.quotes as QuoteController;
		const quote = await controller.rejectQuote(ctx.params.id, ctx.body.reason);
		if (!quote) return { error: "Cannot reject this quote" };
		void ctx.context.events?.emit("quote.rejected", {
			quoteId: quote.id,
			customerId: quote.customerId,
			reason: ctx.body.reason,
		});
		return { quote };
	},
);
