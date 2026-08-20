import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { QuoteController } from "../../service";

export const deleteQuoteEndpoint = createAdminEndpoint(
	"/admin/quotes/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.quotes as QuoteController;
		const ok = await controller.deleteQuote(ctx.params.id);
		if (!ok) return { error: "Quote not found" };
		return { success: true };
	},
);
