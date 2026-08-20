import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { DoordashController } from "../../service";

export const updateZoneEndpoint = createAdminEndpoint(
	"/admin/doordash/zones/:id",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			isActive: z.boolean().optional(),
			radius: z.number().min(0.1).optional(),
			centerLat: z.number().min(-90).max(90).optional(),
			centerLng: z.number().min(-180).max(180).optional(),
			minOrderAmount: z.number().min(0).optional(),
			deliveryFee: z.number().min(0).optional(),
			estimatedMinutes: z.number().int().min(1).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.doordash as DoordashController;
		const zone = await controller.updateZone(ctx.params.id, {
			name: ctx.body.name,
			isActive: ctx.body.isActive,
			radius: ctx.body.radius,
			centerLat: ctx.body.centerLat,
			centerLng: ctx.body.centerLng,
			minOrderAmount: ctx.body.minOrderAmount,
			deliveryFee: ctx.body.deliveryFee,
			estimatedMinutes: ctx.body.estimatedMinutes,
		});
		if (!zone) return { error: "Zone not found", status: 404 };
		return { zone };
	},
);
