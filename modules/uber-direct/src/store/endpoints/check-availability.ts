import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { UberDirectController } from "../../service";

export const checkAvailability = createStoreEndpoint(
	"/uber-direct/availability",
	{
		method: "GET",
		query: z.object({
			lat: z.coerce.number(),
			lng: z.coerce.number(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.uberDirect as UberDirectController;
		const result = await controller.checkAvailability({
			lat: ctx.query.lat,
			lng: ctx.query.lng,
		});
		return {
			available: result.available,
			deliveryFee: result.area?.deliveryFee,
			estimatedMinutes: result.area?.estimatedMinutes,
		};
	},
);
