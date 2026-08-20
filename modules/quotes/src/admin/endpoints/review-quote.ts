import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { QuoteController } from "../../service";

export const reviewQuoteEndpoint = createAdminEndpoint(
	"/admin/quotes/:id/review",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.quotes as QuoteController;
		const quote = await controller.reviewQuote(ctx.params.id);
		if (!quote) return { error: "Cannot review this quote" };
		return { quote };
	},
);
