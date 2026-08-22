import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { UberDirectController } from "../../service";

export const createServiceAreaEndpoint = createAdminEndpoint(
	"/admin/uber-direct/service-areas/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			radius: z.number().min(0.1),
			centerLat: z.number().min(-90).max(90),
			centerLng: z.number().min(-180).max(180),
			deliveryFee: z.number().min(0),
			estimatedMinutes: z.number().int().min(1),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.uberDirect as UberDirectController;
		const area = await controller.createServiceArea({
			name: ctx.body.name,
			radius: ctx.body.radius,
			centerLat: ctx.body.centerLat,
			centerLng: ctx.body.centerLng,
			deliveryFee: ctx.body.deliveryFee,
			estimatedMinutes: ctx.body.estimatedMinutes,
			isActive: ctx.body.isActive,
		});
		return { area };
	},
);
