import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { ShippingController } from "../../service";

export const createZone = createAdminEndpoint(
	"/admin/shipping/zones/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			countries: z.array(z.string().length(2)).optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const zone = await controller.createZone({
			name: ctx.body.name,
			countries: ctx.body.countries,
			isActive: ctx.body.isActive,
		});
		return { zone };
	},
);
