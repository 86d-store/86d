import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { QuoteController } from "../../service";

export const removeItemEndpoint = createAdminEndpoint(
	"/admin/quotes/:id/items/:itemId/remove",
	{
		method: "POST",
		params: z.object({
			id: z.string().max(128),
			itemId: z.string().max(128),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.quotes as QuoteController;
		const ok = await controller.removeItem(ctx.params.id, ctx.params.itemId);
		if (!ok)
			return { error: "Cannot remove item — quote must be in draft status" };
		return { success: true };
	},
);
