import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { QuoteController } from "../../service";

export const createQuoteEndpoint = createAdminEndpoint(
	"/admin/quotes/create",
	{
		method: "POST",
		body: z.object({
			customerEmail: z.string().email().max(256),
			customerName: z.string().min(1).max(256).transform(sanitizeText),
			customerId: z.string().max(128).optional(),
			companyName: z.string().max(256).transform(sanitizeText).optional(),
			notes: z.string().max(2000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.quotes as QuoteController;
		const quote = await controller.createQuote({
			customerId: ctx.body.customerId ?? "",
			customerEmail: ctx.body.customerEmail,
			customerName: ctx.body.customerName,
			companyName: ctx.body.companyName,
			notes: ctx.body.notes,
		});
		return { quote };
	},
);
