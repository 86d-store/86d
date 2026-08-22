import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { ShippingController } from "../../service";

export const createCarrier = createAdminEndpoint(
	"/admin/shipping/carriers/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			code: z.string().min(1).max(50).transform(sanitizeText),
			trackingUrlTemplate: z.string().max(500).optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const carrier = await controller.createCarrier({
			name: ctx.body.name,
			code: ctx.body.code,
			trackingUrlTemplate: ctx.body.trackingUrlTemplate,
			isActive: ctx.body.isActive,
		});
		return { carrier };
	},
);
