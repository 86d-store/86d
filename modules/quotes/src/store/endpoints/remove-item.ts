import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { QuoteController } from "../../service";

export const removeItemEndpoint = createStoreEndpoint(
	"/quotes/:id/items/remove",
	{
		method: "POST",
		params: z.object({
			id: z.string().max(200),
		}),
		body: z.object({
			quoteId: z.string().max(200).optional(),
			itemId: z.string().max(200),
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

		const removed = await controller.removeItem(quoteId, ctx.body.itemId);
		if (!removed) return { error: "Cannot remove this item", status: 422 };
		return { success: true };
	},
);
