import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { BackordersController } from "../../service";

export const cancelBackorderAdmin = createAdminEndpoint(
	"/admin/backorders/:id/cancel",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
		body: z.object({
			reason: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.backorders as BackordersController;
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
