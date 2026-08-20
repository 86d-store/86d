import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { ShippingController } from "../../service";

export const updateMethod = createAdminEndpoint(
	"/admin/shipping/methods/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			description: z.string().max(1000).transform(sanitizeText).optional(),
			estimatedDaysMin: z.number().int().min(0).max(365).optional(),
			estimatedDaysMax: z.number().int().min(0).max(365).optional(),
			isActive: z.boolean().optional(),
			sortOrder: z.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const method = await controller.updateMethod(ctx.params.id, {
			name: ctx.body.name,
			description: ctx.body.description,
			estimatedDaysMin: ctx.body.estimatedDaysMin,
			estimatedDaysMax: ctx.body.estimatedDaysMax,
			isActive: ctx.body.isActive,
			sortOrder: ctx.body.sortOrder,
		});
		if (!method) return { error: "Shipping method not found", status: 404 };
		return { method };
	},
);
