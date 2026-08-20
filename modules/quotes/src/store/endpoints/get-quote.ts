import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { QuoteController } from "../../service";

export const getQuoteEndpoint = createStoreEndpoint(
	"/quotes/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.quotes as QuoteController;
		const quote = await controller.getQuote(ctx.params.id);
		if (!quote) return { error: "Quote not found", status: 404 };

		// Verify ownership — return 404 to avoid leaking existence
		const customerId = ctx.context.session?.user.id;
		if (quote.customerId && quote.customerId !== customerId) {
			return { error: "Quote not found", status: 404 };
		}

		const items = await controller.getItems(ctx.params.id);
		const comments = await controller.getComments(ctx.params.id);
		return { quote, items, comments };
	},
);
