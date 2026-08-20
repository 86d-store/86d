import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { QuoteController } from "../../service";

export const getQuoteAdminEndpoint = createAdminEndpoint(
	"/admin/quotes/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.quotes as QuoteController;
		const quote = await controller.getQuote(ctx.params.id);
		if (!quote) return { error: "Quote not found" };

		const items = await controller.getItems(ctx.params.id);
		const comments = await controller.getComments(ctx.params.id);
		const history = await controller.getHistory(ctx.params.id);
		return { quote, items, comments, history };
	},
);
