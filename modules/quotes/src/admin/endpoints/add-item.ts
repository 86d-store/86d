import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { QuoteController } from "../../service";

export const addItemEndpoint = createAdminEndpoint(
	"/admin/quotes/:id/items",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
		body: z.object({
			productId: z.string().min(1).max(128),
			productName: z.string().min(1).max(512).transform(sanitizeText),
			sku: z.string().max(128).optional(),
			quantity: z.number().int().min(1),
			unitPrice: z.number().int().min(0),
			notes: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.quotes as QuoteController;
		const item = await controller.addItem({
			quoteId: ctx.params.id,
			productId: ctx.body.productId,
			productName: ctx.body.productName,
			sku: ctx.body.sku,
			quantity: ctx.body.quantity,
			unitPrice: ctx.body.unitPrice,
			notes: ctx.body.notes,
		});
		if (!item)
			return { error: "Cannot add item — quote must be in draft status" };
		return { item };
	},
);
