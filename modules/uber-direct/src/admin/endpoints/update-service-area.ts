import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { UberDirectController } from "../../service";

export const updateServiceAreaEndpoint = createAdminEndpoint(
	"/admin/uber-direct/service-areas/:id",
	{
		method: "PATCH",
		params: z.object({ id: z.string().min(1) }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			radius: z.number().min(0.1).optional(),
			centerLat: z.number().min(-90).max(90).optional(),
			centerLng: z.number().min(-180).max(180).optional(),
			deliveryFee: z.number().min(0).optional(),
			estimatedMinutes: z.number().int().min(1).optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.uberDirect as UberDirectController;
		const area = await controller.updateServiceArea(ctx.params.id, ctx.body);
		if (!area) return { error: "Service area not found", status: 404 };
		return { area };
	},
);
