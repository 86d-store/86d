import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { BackordersController } from "../../service";

export const setPolicy = createAdminEndpoint(
	"/admin/backorders/policies/set",
	{
		method: "POST",
		body: z.object({
			productId: z.string(),
			enabled: z.boolean(),
			maxQuantityPerOrder: z.number().int().min(1).optional(),
			maxTotalBackorders: z.number().int().min(1).optional(),
			estimatedLeadDays: z.number().int().min(0).optional(),
			autoConfirm: z.boolean().optional(),
			message: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.backorders as BackordersController;
		const policy = await controller.setPolicy({
			productId: ctx.body.productId,
			enabled: ctx.body.enabled,
			maxQuantityPerOrder: ctx.body.maxQuantityPerOrder,
			maxTotalBackorders: ctx.body.maxTotalBackorders,
			estimatedLeadDays: ctx.body.estimatedLeadDays,
			autoConfirm: ctx.body.autoConfirm,
			message: ctx.body.message,
		});
		return { policy };
	},
);
