import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FavorController } from "../../service";

export const checkAvailability = createStoreEndpoint(
	"/favor/availability",
	{
		method: "GET",
		query: z.object({
			zipCode: z.string().min(1).max(20),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.favor as FavorController;
		const result = await controller.checkAvailability(ctx.query.zipCode);

		return {
			available: result.available,
			deliveryFee: result.area?.deliveryFee,
			estimatedMinutes: result.area?.estimatedMinutes,
			minOrderAmount: result.area?.minOrderAmount,
		};
	},
);
