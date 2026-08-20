import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { ShippingController } from "../../service";

export const updateRate = createAdminEndpoint(
	"/admin/shipping/rates/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			price: z.number().int().min(0).optional(),
			minOrderAmount: z.number().int().min(0).optional(),
			maxOrderAmount: z.number().int().min(0).optional(),
			minWeight: z.number().min(0).optional(),
			maxWeight: z.number().min(0).optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const rate = await controller.updateRate(ctx.params.id, {
			name: ctx.body.name,
			price: ctx.body.price,
			minOrderAmount: ctx.body.minOrderAmount,
			maxOrderAmount: ctx.body.maxOrderAmount,
			minWeight: ctx.body.minWeight,
			maxWeight: ctx.body.maxWeight,
			isActive: ctx.body.isActive,
		});
		if (!rate) return { error: "Shipping rate not found", status: 404 };
		return { rate };
	},
);
