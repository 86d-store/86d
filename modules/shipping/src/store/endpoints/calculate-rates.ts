import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ShippingController } from "../../service";

export const calculateRates = createStoreEndpoint(
	"/shipping/calculate",
	{
		method: "POST",
		body: z.object({
			country: z.string().length(2),
			orderAmount: z.number().int().min(0),
			weight: z.number().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.shipping as ShippingController;
		const rates = await controller.calculateRates({
			country: ctx.body.country,
			orderAmount: ctx.body.orderAmount,
			weight: ctx.body.weight,
		});
		return { rates };
	},
);
