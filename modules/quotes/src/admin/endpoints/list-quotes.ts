import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { QuoteController, QuoteStatus } from "../../service";

export const listQuotesEndpoint = createAdminEndpoint(
	"/admin/quotes",
	{
		method: "GET",
		query: z.object({
			status: z.string().optional(),
			customerId: z.string().optional(),
			skip: z.coerce.number().int().min(0).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.quotes as QuoteController;
		const quotes = await controller.listQuotes({
			status: ctx.query.status as QuoteStatus | undefined,
			customerId: ctx.query.customerId,
			skip: ctx.query.skip,
			take: ctx.query.take,
		});
		return { quotes };
	},
);
