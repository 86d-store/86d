import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { QuoteController } from "../../service";

export const counterQuoteEndpoint = createAdminEndpoint(
	"/admin/quotes/:id/counter",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
		body: z.object({
			items: z
				.array(
					z.object({
						itemId: z.string().max(128),
						offeredPrice: z.number().min(0),
					}),
				)
				.max(200),
			expiresAt: z.coerce.date().optional(),
			adminNotes: z.string().max(2000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.quotes as QuoteController;
		const quote = await controller.counterQuote(ctx.params.id, {
			items: ctx.body.items,
			expiresAt: ctx.body.expiresAt,
			adminNotes: ctx.body.adminNotes,
		});
		if (!quote) return { error: "Cannot counter this quote" };
		return { quote };
	},
);
