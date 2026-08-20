import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { ShippingController } from "../../service";

export const updateZone = createAdminEndpoint(
	"/admin/shipping/zones/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			countries: z.array(z.string().length(2)).optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const zone = await controller.updateZone(ctx.params.id, {
			name: ctx.body.name,
			countries: ctx.body.countries,
			isActive: ctx.body.isActive,
		});
		if (!zone) return { error: "Shipping zone not found", status: 404 };
		return { zone };
	},
);
