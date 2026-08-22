import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { BackordersController } from "../../service";

export const updateStatus = createAdminEndpoint(
	"/admin/backorders/:id/status",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
		body: z.object({
			status: z.enum([
				"pending",
				"confirmed",
				"allocated",
				"shipped",
				"delivered",
				"cancelled",
			]),
			reason: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.backorders as BackordersController;
		const backorder = await controller.updateStatus(
			ctx.params.id,
			ctx.body.status,
			ctx.body.reason,
		);
		if (!backorder) {
			return { error: "Backorder not found", backorder: null };
		}
		return { backorder };
	},
);
