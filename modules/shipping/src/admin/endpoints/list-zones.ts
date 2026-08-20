import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ShippingController } from "../../service";

export const listZones = createAdminEndpoint(
	"/admin/shipping/zones",
	{
		method: "GET",
		query: z.object({
			activeOnly: z
				.string()
				.optional()
				.transform((v) => v === "true"),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const zones = await controller.listZones({
			activeOnly: ctx.query.activeOnly,
		});
		return { zones };
	},
);
