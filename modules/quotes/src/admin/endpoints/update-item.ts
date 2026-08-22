import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { QuoteController } from "../../service";

export const updateItemEndpoint = createAdminEndpoint(
	"/admin/quotes/:id/items/:itemId",
	{
		method: "POST",
		params: z.object({
			id: z.string().max(128),
			itemId: z.string().max(128),
		}),
		body: z.object({
			quantity: z.number().int().min(1).optional(),
			unitPrice: z.number().int().min(0).optional(),
			notes: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.quotes as QuoteController;
		const item = await controller.updateItem(ctx.params.id, ctx.params.itemId, {
			quantity: ctx.body.quantity,
			unitPrice: ctx.body.unitPrice,
			notes: ctx.body.notes,
		});
		if (!item)
			return { error: "Cannot update item — quote must be in draft status" };
		return { item };
	},
);
