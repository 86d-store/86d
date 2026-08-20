import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { QuoteController } from "../../service";

export const updateItemEndpoint = createStoreEndpoint(
	"/quotes/:id/items/update",
	{
		method: "POST",
		params: z.object({
			id: z.string().max(200),
		}),
		body: z.object({
			quoteId: z.string().max(200).optional(),
			itemId: z.string().max(200),
			quantity: z.number().int().min(1).max(9999).optional(),
			unitPrice: z.number().min(0).optional(),
			notes: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) return { error: "Authentication required", status: 401 };

		const controller = ctx.context.controllers.quotes as QuoteController;
		const quoteId = ctx.params.id;
		if (ctx.body.quoteId && ctx.body.quoteId !== quoteId) {
			return { error: "Quote not found", status: 404 };
		}

		// Verify ownership before mutating
		const quote = await controller.getQuote(quoteId);
		if (!quote || quote.customerId !== customerId) {
			return { error: "Quote not found", status: 404 };
		}

		const item = await controller.updateItem(quoteId, ctx.body.itemId, {
			quantity: ctx.body.quantity,
			unitPrice: ctx.body.unitPrice,
			notes: ctx.body.notes,
		});
		if (!item) return { error: "Cannot update this item", status: 422 };
		return { item };
	},
);
