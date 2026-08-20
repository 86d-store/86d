import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { PreordersController } from "../../service";

export const cancelPreorder = createStoreEndpoint(
	"/preorders/:id/cancel",
	{
		method: "POST",
		params: z.object({
			id: z.string().max(200),
		}),
		body: z.object({
			reason: z.string().max(500).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.preorders as PreordersController;
		const existing = await controller.getPreorderItem(ctx.params.id);
		if (!existing) {
			return { error: "Preorder not found", item: null };
		}

		if (existing.customerId !== session.user.id) {
			return { error: "Preorder not found", item: null };
		}

		const item = await controller.cancelPreorderItem(
			ctx.params.id,
			ctx.body.reason,
		);
		if (!item) {
			return { error: "Preorder not found", item: null };
		}

		return { item };
	},
);
