import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { QuoteController } from "../../service";

export const approveQuoteEndpoint = createAdminEndpoint(
	"/admin/quotes/:id/approve",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
		body: z.object({
			expiresAt: z.coerce.date().optional(),
			adminNotes: z.string().max(2000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.quotes as QuoteController;
		const quote = await controller.approveAsIs(ctx.params.id, {
			expiresAt: ctx.body.expiresAt,
			adminNotes: ctx.body.adminNotes,
		});
		if (!quote) return { error: "Cannot approve this quote" };
		void ctx.context.events?.emit("quote.reviewed", {
			quoteId: quote.id,
			customerId: quote.customerId,
			status: quote.status,
		});
		return { quote };
	},
);
