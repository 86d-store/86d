import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { QuoteController, QuoteStatus } from "../../service";

export const myQuotesEndpoint = createStoreEndpoint(
	"/quotes/my",
	{
		method: "GET",
		query: z.object({
			status: z.string().max(50).optional(),
			skip: z.coerce.number().int().min(0).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) return { error: "Authentication required", status: 401 };

		const controller = ctx.context.controllers.quotes as QuoteController;
		const quotes = await controller.getMyQuotes({
			customerId,
			status: ctx.query.status as QuoteStatus | undefined,
			skip: ctx.query.skip,
			take: ctx.query.take,
		});
		return { quotes };
	},
);
