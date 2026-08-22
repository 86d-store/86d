import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ShippingController } from "../../service";

export const listCarriers = createAdminEndpoint(
	"/admin/shipping/carriers",
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
		const carriers = await controller.listCarriers({
			activeOnly: ctx.query.activeOnly,
		});
		return { carriers };
	},
);
