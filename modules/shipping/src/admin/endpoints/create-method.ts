import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { ShippingController } from "../../service";

export const createMethod = createAdminEndpoint(
	"/admin/shipping/methods/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			description: z.string().max(1000).transform(sanitizeText).optional(),
			estimatedDaysMin: z.number().int().min(0).max(365),
			estimatedDaysMax: z.number().int().min(0).max(365),
			isActive: z.boolean().optional(),
			sortOrder: z.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const method = await controller.createMethod({
			name: ctx.body.name,
			description: ctx.body.description,
			estimatedDaysMin: ctx.body.estimatedDaysMin,
			estimatedDaysMax: ctx.body.estimatedDaysMax,
			isActive: ctx.body.isActive,
			sortOrder: ctx.body.sortOrder,
		});
		return { method };
	},
);
