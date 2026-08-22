import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { DoordashController } from "../../service";

export const createZoneEndpoint = createAdminEndpoint(
	"/admin/doordash/zones/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			radius: z.number().min(0.1),
			centerLat: z.number().min(-90).max(90),
			centerLng: z.number().min(-180).max(180),
			minOrderAmount: z.number().min(0).optional(),
			deliveryFee: z.number().min(0),
			estimatedMinutes: z.number().int().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.doordash as DoordashController;
		const zone = await controller.createZone({
			name: ctx.body.name,
			radius: ctx.body.radius,
			centerLat: ctx.body.centerLat,
			centerLng: ctx.body.centerLng,
			minOrderAmount: ctx.body.minOrderAmount,
			deliveryFee: ctx.body.deliveryFee,
			estimatedMinutes: ctx.body.estimatedMinutes,
		});
		return { zone };
	},
);
