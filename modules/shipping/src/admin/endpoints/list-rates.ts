import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ShippingController } from "../../service";

export const listRates = createAdminEndpoint(
	"/admin/shipping/zones/:id/rates",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
		query: z.object({
			activeOnly: z
				.string()
				.optional()
				.transform((v) => v === "true"),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const rates = await controller.listRates({
			zoneId: ctx.params.id,
			activeOnly: ctx.query.activeOnly,
		});
		return { rates };
	},
);
