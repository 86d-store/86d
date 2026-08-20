import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { BackordersController } from "../../service";

export const cancelBackorder = createStoreEndpoint(
	"/backorders/:id/cancel",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
		body: z.object({
			reason: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers
			.backorders as BackordersController;
		const existing = await controller.getBackorder(ctx.params.id);
		if (!existing) {
			return { error: "Backorder not found", cancelled: false };
		}

		if (existing.customerId !== session.user.id) {
			return { error: "Backorder not found", cancelled: false };
		}

		const backorder = await controller.cancelBackorder(
			ctx.params.id,
			ctx.body.reason,
		);
		if (!backorder) {
			return { error: "Backorder not found", cancelled: false };
		}

		return { cancelled: true, backorder };
	},
);
