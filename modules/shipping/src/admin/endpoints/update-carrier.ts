import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { ShippingController } from "../../service";

export const updateCarrier = createAdminEndpoint(
	"/admin/shipping/carriers/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			code: z.string().min(1).max(50).transform(sanitizeText).optional(),
			trackingUrlTemplate: z.string().max(500).optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const carrier = await controller.updateCarrier(ctx.params.id, {
			name: ctx.body.name,
			code: ctx.body.code,
			trackingUrlTemplate: ctx.body.trackingUrlTemplate,
			isActive: ctx.body.isActive,
		});
		if (!carrier) return { error: "Shipping carrier not found", status: 404 };
		return { carrier };
	},
);
